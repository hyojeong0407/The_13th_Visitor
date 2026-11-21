/* =========================================================================
   4-1. 플레이어 이동 · 카메라 · 문/엘리베이터 전환 · 은신 · 구역 이벤트 모듈 (v1.7.0)
   ========================================================================= */
import { ROOMS, NPCS, ELEVATOR_DESTINATIONS, GHOST_EVENTS } from "./data.js";
import { TILE, PLAYER_CONFIG, GHOST_CONFIG, SANITY_CONFIG } from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE,
  setGhostState, isDoor1304Unlocked, unlockDoor1304,
  markHudDirty, autoSaveGame
} from "./state.js";
import { playSfx } from "./audio.js";
import { isBlocked, startGhostWarning, beginBreathHoldMinigame } from "./ghost.js";
import { say, addLog, renderTutorialBanner } from "./ui.js";

export function dirToDelta(dir) {
  if (dir === "up") return { dx: 0, dy: -1 };
  if (dir === "down") return { dx: 0, dy: 1 };
  if (dir === "left") return { dx: -1, dy: 0 };
  if (dir === "right") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 1 };
}

export function getFacingTile() {
  const { dx, dy } = dirToDelta(state.player.dir);
  return { x: state.player.x + dx, y: state.player.y + dy };
}

export function syncPlayerPixelToGrid() {
  state.player.px = state.player.x * TILE;
  state.player.py = state.player.y * TILE;
  state.player.moving = false;
  state.player.walkTimer = 0;
}

export function getTargetCamera(canvas) {
  const r = ROOMS[state.currentRoom];
  if (!r || !canvas) return { x: 0, y: 0 };
  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;

  const tx = mapW <= canvas.width
    ? -(canvas.width - mapW) / 2
    : Math.max(0, Math.min(mapW - canvas.width, (state.player.px + TILE / 2) - canvas.width / 2));

  const ty = mapH <= canvas.height
    ? -(canvas.height - mapH) / 2
    : Math.max(0, Math.min(mapH - canvas.height, (state.player.py + TILE / 2) - canvas.height / 2));

  return { x: tx, y: ty };
}

export function snapCamera(canvas) {
  const target = getTargetCamera(canvas);
  state.camera.x = target.x;
  state.camera.y = target.y;
}

export function updateCamera(dt, canvas) {
  const target = getTargetCamera(canvas);
  const lerp = 1 - Math.exp(-12 * dt);
  state.camera.x += (target.x - state.camera.x) * lerp;
  state.camera.y += (target.y - state.camera.y) * lerp;
  if (Math.abs(target.x - state.camera.x) < 0.25) state.camera.x = target.x;
  if (Math.abs(target.y - state.camera.y) < 0.25) state.camera.y = target.y;
}

function isShiftHeld() {
  return Boolean(state.keys["ShiftLeft"] || state.keys["ShiftRight"]);
}

function getHeldDirection() {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return null;
  if (state.keys["ArrowUp"] || state.keys["KeyW"] || state.padKeys.up) return { dx: 0, dy: -1 };
  if (state.keys["ArrowDown"] || state.keys["KeyS"] || state.padKeys.down) return { dx: 0, dy: 1 };
  if (state.keys["ArrowLeft"] || state.keys["KeyA"] || state.padKeys.left) return { dx: -1, dy: 0 };
  if (state.keys["ArrowRight"] || state.keys["KeyD"] || state.padKeys.right) return { dx: 1, dy: 0 };
  return null;
}

export function startStep(dx, dy, isSprinting, hooks) {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return false;
  if (state.isHiding) {
    if (state.bumpCooldown <= 0) {
      state.bumpCooldown = 0.45;
      say("SYSTEM", "숨어 있는 상태에서는 이동할 수 없습니다. [H] 키를 눌러 먼저 나오세요.", "c-system");
    }
    return false;
  }
  if (state.player.moving) return false;

  if (dx < 0) state.player.dir = "left";
  else if (dx > 0) state.player.dir = "right";
  else if (dy < 0) state.player.dir = "up";
  else if (dy > 0) state.player.dir = "down";

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  const r = ROOMS[state.currentRoom];
  const door = r.doors.find(d => d.x === nx && d.y === ny);
  if (door) {
    if (state.bumpCooldown <= 0) {
      state.bumpCooldown = 0.32;
      handleDoorTransition(door, hooks);
    }
    return false;
  }

  if (isBlocked(state.currentRoom, nx, ny, NPCS)) {
    if (state.bumpCooldown <= 0) {
      state.bumpCooldown = 0.35;
      playSfx("bump");
    }
    return false;
  }

  state.player.x = nx;
  state.player.y = ny;
  state.player.moving = true;
  state.player.walkTimer = 0;
  state.player.stepParity = 1 - state.player.stepParity;
  playSfx("step");

  if (state.tutorialStep === 1) {
    if (hooks.completeTutorialStep) hooks.completeTutorialStep(1);
    else if (hooks.advanceTutorialStep) hooks.advanceTutorialStep();
  }
  if (isSprinting) {
    state.stamina = Math.max(0, state.stamina - PLAYER_CONFIG.SPRINT_STEP_COST);
    markHudDirty();
  }
  return true;
}

export function updatePlayerMovement(dt, hooks) {
  if (state.bumpCooldown > 0) state.bumpCooldown = Math.max(0, state.bumpCooldown - dt);
  const isSprinting = (isShiftHeld() && state.stamina > PLAYER_CONFIG.MIN_SPRINT_STAMINA && !state.isHiding);
  const moveSpeed = isSprinting ? PLAYER_CONFIG.SPRINT_SPEED : PLAYER_CONFIG.WALK_SPEED;

  if (state.player.moving) {
    state.player.walkTimer += dt * (isSprinting ? 1.55 : 1.0);
    const targetPx = state.player.x * TILE;
    const targetPy = state.player.y * TILE;
    const dx = targetPx - state.player.px;
    const dy = targetPy - state.player.py;
    const dist = Math.hypot(dx, dy);
    const step = moveSpeed * dt;

    if (dist <= step) {
      state.player.px = targetPx;
      state.player.py = targetPy;
      state.player.moving = false;
      checkStepEvents(hooks);

      if (state.mode === GAME_MODE.PLAY) {
        const held = getHeldDirection();
        if (held) startStep(held.dx, held.dy, isSprinting, hooks);
      }
    } else {
      state.player.px += (dx / dist) * step;
      state.player.py += (dy / dist) * step;
    }
  } else {
    state.player.walkTimer = 0;
    const held = getHeldDirection();
    if (held) startStep(held.dx, held.dy, isSprinting, hooks);
  }

  if ((!state.player.moving || !isSprinting) && state.stamina < 100) {
    state.stamina = Math.min(100, state.stamina + PLAYER_CONFIG.STAMINA_REGEN * dt);
    markHudDirty();
  }
}

export function handleDoorTransition(door, hooks) {
  if (door.to === "엘리베이터" && state.ghost.state !== GHOST_STATE.IDLE) {
    playSfx("ghost");
    say("SYSTEM", "엘리베이터 문이 굳게 닫혀 열리지 않는다! 복도나 방의 은신처에 숨어야 한다 [H]!", "c-ghost");
    return;
  }

  if (door.to === "1304호 거실" && state.currentRoom === "13층 복도") {
    if (isDoor1304Unlocked()) {
      if (!state.flags.door1304Unlocked) {
        unlockDoor1304();
        playSfx("door");
        addLog("도출해낸 13층의 진실을 바탕으로 굳게 잠긴 1304호 현관문을 열었다.");
      }
    } else {
      say(
        "SYSTEM",
        "1304호 철문이 굳게 잠겨 있다.\n[Tab] 수사 수첩에서 13층의 존재 또는 방화문 봉쇄에 관한 단서들을 조합해 진실을 먼저 도출해야 한다.",
        "c-system"
      );
      return;
    }
  }

  if (door.secret && !state.flags.secretOpen) {
    if (state.deduced.includes("combo_secret")) {
      state.flags.secretOpen = true;
      playSfx("door");
      addLog("도출된 진실로 벽장 뒤의 비밀 통로를 열었다!");
    } else {
      say(
        "SYSTEM",
        "벽장 뒤에서 차가운 바람이 새어 나오지만 굳게 막혀 있다.\n[Tab] 수사 수첩에서 관련 단서들을 조합해 벽장 뒤의 진실을 먼저 밝혀야 한다.",
        "c-system"
      );
      return;
    }
  }

  const prevRoom = state.currentRoom;
  state.currentRoom = door.to;
  state.roomFadeAlpha = state.prefs.reducedMotion ? 0 : 0.85;
  state.player.x = door.tx;
  state.player.y = door.ty;
  syncPlayerPixelToGrid();
  snapCamera(hooks.canvas);
  playSfx("door");
  markHudDirty();

  if (state.currentRoom === "엘리베이터") {
    state.elevatorFloor = prevRoom === "지하 주차장" ? "지하 주차장" : (prevRoom === "13층 복도" ? "13층 복도" : "1층 복도");
    openElevatorMenu(hooks);
    return;
  }

  if (state.ghost.state !== GHOST_STATE.IDLE) {
    const path = state.ghost.escapePathRooms || [prevRoom];
    const backtracked = path.includes(state.currentRoom);
    if (!backtracked) {
      path.push(state.currentRoom);
    } else {
      state.ghost.escapePathRooms = [prevRoom, state.currentRoom];
    }
    state.ghost.escapeRoomCount = Math.max(0, state.ghost.escapePathRooms.length - 1);

    if (state.ghost.escapeRoomCount >= GHOST_CONFIG.ESCAPE_ROOMS_REQUIRED) {
      setGhostState(GHOST_STATE.IDLE);
      state.lightState = "on";
      playSfx("light_on");
      hooks.changeSanity(SANITY_CONFIG.ESCAPE_REWARD, "연속 구역 이탈로 추격 따돌림");
      addLog("서로 다른 두 구역을 연속으로 벗어나 13번째 방문자의 추적을 따돌렸다!");
      say("SYSTEM", "거친 숨을 몰아쉬며 추격자의 시야에서 완전히 벗어났다! 형광등이 다시 정상적으로 켜졌다.", "c-system");
      if (state.tutorialStep === 4) {
        state.tutorialStep = 0;
        renderTutorialBanner();
      }
      autoSaveGame();
    } else {
      state.ghost.room = state.currentRoom;
      state.ghost.lastBfsTileKey = -1;
      state.ghost.cachedBfsStep = null;
      const backtrackNotice = backtracked
        ? " (방금 지나온 구역으로 되돌아가면 추격자를 따돌릴 수 없다!)"
        : "";
      if (state.ghost.state === GHOST_STATE.WARNING) {
        state.lightState = "flicker";
        state.ghost.spawnX = door.tx;
        state.ghost.spawnY = door.ty;
        addLog(`${state.currentRoom}으로 빠져나왔다! 새로운 구역으로 한 번 더 벗어나거나 은신처에 숨으세요 [H]!`);
        say("SYSTEM", `${state.currentRoom}의 형광등까지 심하게 깜빡인다! 새로운 구역으로 더 도망치거나 은신처에 숨으세요!${backtrackNotice}`, "c-system");
      } else {
        state.lightState = "out";
        state.ghost.px = door.tx * TILE;
        state.ghost.py = door.ty * TILE;
        state.ghost.entryDelay = GHOST_CONFIG.ENTRY_DELAY;
        addLog(`13번째 방문자가 ${state.currentRoom}까지 쫓아왔다! 새로운 구역으로 더 벗어나거나 숨으세요!`);
        say("13번째 방문자", `문틈 너머로 무거운 발소리가 따라 들어왔다! 새로운 구역으로 도망치거나 은신처에 숨어라!${backtrackNotice}`, "c-ghost");
      }
    }
  } else {
    state.lightState = state.currentRoom === "1304호 숨겨진 방" ? "out" : "on";
    if (state.currentRoom === "1304호 숨겨진 방" && !state.flags.visitedSecret) {
      state.flags.visitedSecret = true;
      say("강현우", "벽장 뒤편에 이런 밀실이 숨겨져 있었어... 방 한가운데 낡은 거울과 기록 보관함이 놓여 있다.", "c-hero");
      hooks.changeSanity(-6, "숨겨진 방의 음산한 기운");
    } else if (!state.lastDialogueImportant) {
      say("SYSTEM", `${state.currentRoom}에 들어왔다.`, "c-system", [], { instant: true });
    }
    autoSaveGame();
  }
}

export function openElevatorMenu(hooks) {
  const choices = ELEVATOR_DESTINATIONS.map(dest => ({
    label: dest.label,
    action: () => {
      state.currentRoom = dest.room;
      state.roomFadeAlpha = state.prefs.reducedMotion ? 0 : 0.85;
      state.lightState = "on";
      state.player.x = dest.x;
      state.player.y = dest.y;
      state.player.dir = dest.dir;
      syncPlayerPixelToGrid();
      snapCamera(hooks.canvas);
      playSfx(dest.sfx || "door");

      if (dest.firstVisitFlag && !state.flags[dest.firstVisitFlag]) {
        state.flags[dest.firstVisitFlag] = true;
        if (dest.firstVisitSanity) {
          hooks.changeSanity(dest.firstVisitSanity, dest.firstVisitSanityReason || "");
        }
        if (dest.firstVisitLog) addLog(dest.firstVisitLog);
      }

      say(
        dest.speaker,
        dest.arrivalText,
        dest.speakerClass,
        [],
        dest.speakerClass === "c-system" ? { instant: true } : {}
      );
      autoSaveGame();
      markHudDirty();
    }
  }));

  say(
    "SYSTEM",
    `엘리베이터 내부다. 현재 층: [${state.elevatorFloor}]\n조작반 맨 아래에는 도면에 없는 붉은색 [13층] 버튼이 희미하게 빛나고 있다.`,
    "c-system",
    choices
  );
  markHudDirty();
}

export function toggleHide() {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return;
  const r = ROOMS[state.currentRoom];
  if (state.isHiding) {
    if (state.ghost.state !== GHOST_STATE.IDLE || state.lightState === "flicker") {
      say("SYSTEM", "아직 바깥에 13번째 방문자의 발소리가 남아 있습니다! 불이 다시 켜질 때까지 숨을 죽이세요.", "c-ghost");
      return;
    }
    state.isHiding = false;
    state.currentHidingId = "";
    state.currentHidingLabel = "";
    playSfx("hide");
    say("SYSTEM", "숨어 있던 곳에서 조심스럽게 나왔다.", "c-system");
    markHudDirty();
    return;
  }

  const facing = getFacingTile();
  const spot =
    r.hidingSpots.find(s => s.x === facing.x && s.y === facing.y) ||
    r.hidingSpots.find(s => Math.abs(s.x - state.player.x) + Math.abs(s.y - state.player.y) <= 1);

  if (!spot) {
    say("SYSTEM", "이 주변에는 몸을 숨길 곳이 없다! 은신처가 있는 구역으로 이동하거나 문을 통해 벗어나야 한다.", "c-system");
    return;
  }

  const isActiveThreatInRoom =
    (state.ghost.state === GHOST_STATE.CHASE || state.ghost.state === GHOST_STATE.SEARCH) &&
    state.ghost.room === state.currentRoom;

  if (isActiveThreatInRoom && state.ghost.entryDelay <= 0) {
    const dist = Math.hypot(state.ghost.px - state.player.px, state.ghost.py - state.player.py);
    if (dist < TILE * GHOST_CONFIG.HIDE_MIN_DIST_TILES) {
      playSfx("ghost");
      say("13번째 방문자", "너무 가깝다! 추격자가 지켜보는 앞에서 은신처에 들어갈 수 없다!", "c-ghost");
      return;
    }
  }

  state.isHiding = true;
  state.player.moving = false;
  state.currentHidingId = spot.id;
  state.currentHidingLabel = spot.label;
  state.hidingUseCount[spot.id] = (state.hidingUseCount[spot.id] || 0) + 1;
  playSfx("hide");
  addLog(`${spot.label} 안에 몸을 숨겼다. (사용 ${state.hidingUseCount[spot.id]}회)`);

  if (state.tutorialStep === 4) {
    state.tutorialStep = 0;
    renderTutorialBanner();
  }

  const repeatWarn = state.hidingUseCount[spot.id] >= 2
    ? " (같은 은신처를 반복 사용해 숨 참기 난이도가 상승했습니다!)"
    : "";

  if (isActiveThreatInRoom) {
    setGhostState(GHOST_STATE.SEARCH);
    state.ghost.patrolTimer = 0;
    beginBreathHoldMinigame(spot.id);
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼지만 13번째 방문자가 주변을 수색한다!${repeatWarn} 지금 즉시 [[blue:[Space]]]를 연타해 숨을 참으세요!`, "c-ghost");
  } else {
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼다.${repeatWarn} 불이 꺼지고 추격자가 다가오면 [[blue:[Space]]]를 눌러 숨을 참으세요.`, "c-system");
  }
  markHudDirty();
}

export function triggerGhostEventById(eventId, hooks, overrides = {}) {
  const ev = GHOST_EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  if (ev.preSfx) playSfx(ev.preSfx);
  startGhostWarning(
    ev.room,
    ev.spawnX,
    ev.spawnY,
    overrides.warningText || ev.warningText,
    overrides.chaseText || ev.chaseText,
    {
      addLog,
      say,
      onTutorial4: () => hooks.startTutorialStep && hooks.startTutorialStep(4)
    }
  );
}

export function checkStepEvents(hooks) {
  if (state.mode !== GAME_MODE.PLAY || state.ghost.state !== GHOST_STATE.IDLE) return;

  for (const ev of GHOST_EVENTS) {
    if (ev.room !== state.currentRoom) continue;
    if (ev.flag && state.flags[ev.flag]) continue;
    if (ev.requiredClue && !state.collected.includes(ev.requiredClue)) continue;
    if (typeof ev.minCollected === "number" && state.collected.length < ev.minCollected) continue;
    if (typeof ev.minX === "number" && state.player.x < ev.minX) continue;
    if (typeof ev.maxX === "number" && state.player.x > ev.maxX) continue;

    if (ev.flag) state.flags[ev.flag] = true;
    triggerGhostEventById(ev.id, hooks);
    return;
  }
}
