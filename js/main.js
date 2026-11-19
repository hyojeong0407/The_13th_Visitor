/* =========================================================================
   7. 메인 진입점 (게임 루프, 추격 밸런스, 상호작용, 단계별 자백, 이벤트 바인딩) (v1.4.2)
   ========================================================================= */
import { APP_VERSION } from "../version.js";
import {
  PROLOGUE_SCENES, FLASHBACK_SCENES, CLUES, COMBINATIONS,
  FIELD_ITEMS, PROPS, ROOMS, NPCS
} from "./data.js";
import {
  TILE, PLAYER_CONFIG, GHOST_CONFIG, SANITY_CONFIG
} from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE,
  setGameMode, setGhostState, setReducedMotion, clearHeldInputs,
  isDoor1304Unlocked, unlockDoor1304, markHudDirty,
  getUnlockedEndings, recordEndingUnlock, hasValidSaveData,
  buildSavePayload, autoSaveGame, applyLoadedData, resetStateFields
} from "./state.js";
import { safeGet, safeSet, isStorageRestricted } from "./storage.js";
import { initAudio, toggleSound, playSfx } from "./audio.js";
import {
  isBlocked, findNearestWalkable, startGhostWarning, beginBreathHoldMinigame,
  holdBreathAction, updateHallucinations, updateLightingAndGhost
} from "./ghost.js";
import { updateVisualTimers, renderGame } from "./render.js";
import {
  formatHighlightedDialogue, say, addLog, toggleNotebookDrawer,
  updateHUD, renderInventoryUI, isClueInterpreted,
  getClueDisplayDescription, renderClueUI, drawSceneArt, renderTutorialBanner
} from "./ui.js";

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

document.title = `13번째 방문자 (The 13th Visitor) v${APP_VERSION}`;
document.querySelectorAll("[data-app-version]").forEach(el => {
  el.textContent = `v${APP_VERSION}`;
});

function dirToDelta(dir) {
  if (dir === "up") return { dx: 0, dy: -1 };
  if (dir === "down") return { dx: 0, dy: 1 };
  if (dir === "left") return { dx: -1, dy: 0 };
  if (dir === "right") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 1 };
}

function getFacingTile() {
  const { dx, dy } = dirToDelta(state.player.dir);
  return { x: state.player.x + dx, y: state.player.y + dy };
}

function syncPlayerPixelToGrid() {
  state.player.px = state.player.x * TILE;
  state.player.py = state.player.y * TILE;
  state.player.moving = false;
  state.player.walkTimer = 0;
}

function getTargetCamera() {
  const r = ROOMS[state.currentRoom];
  if (!r) return { x: 0, y: 0 };
  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;

  let tx = mapW <= canvas.width
    ? -(canvas.width - mapW) / 2
    : Math.max(0, Math.min(mapW - canvas.width, (state.player.px + TILE / 2) - canvas.width / 2));

  let ty = mapH <= canvas.height
    ? -(canvas.height - mapH) / 2
    : Math.max(0, Math.min(mapH - canvas.height, (state.player.py + TILE / 2) - canvas.height / 2));

  return { x: tx, y: ty };
}

function snapCamera() {
  const target = getTargetCamera();
  state.camera.x = target.x;
  state.camera.y = target.y;
}

function updateCamera(dt) {
  const target = getTargetCamera();
  const lerp = 1 - Math.exp(-12 * dt);
  state.camera.x += (target.x - state.camera.x) * lerp;
  state.camera.y += (target.y - state.camera.y) * lerp;
  if (Math.abs(target.x - state.camera.x) < 0.25) state.camera.x = target.x;
  if (Math.abs(target.y - state.camera.y) < 0.25) state.camera.y = target.y;
}

function startTutorialStep(stepNum) {
  if (state.flags.tutorialDone) return;
  state.tutorialStep = stepNum;
  renderTutorialBanner();
  bindTutorialButtons();
}

function bindTutorialButtons() {
  const skipBtn = document.getElementById("btn-tut-skip");
  const nextBtn = document.getElementById("btn-tut-next");
  if (skipBtn) skipBtn.onclick = skipTutorial;
  if (nextBtn) nextBtn.onclick = advanceTutorialStep;
}

function advanceTutorialStep() {
  if (state.tutorialStep <= 0) return;
  playSfx("switch");
  if (state.tutorialStep === 1) {
    state.tutorialStep = 2;
    renderTutorialBanner();
    bindTutorialButtons();
  } else {
    state.tutorialStep = 0;
    renderTutorialBanner();
  }
}

function skipTutorial() {
  state.tutorialStep = 0;
  state.flags.tutorialDone = true;
  renderTutorialBanner();
}

function startPrologue() {
  setGameMode(GAME_MODE.PROLOGUE);
  state.prologueIndex = 0;
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "flex";
  renderPrologueScene();
}

function renderPrologueScene() {
  const scene = PROLOGUE_SCENES[state.prologueIndex];
  if (!scene) { finishPrologue(); return; }
  playSfx("step");
  document.getElementById("prologue-chapter").textContent = scene.chapter;
  document.getElementById("prologue-page").textContent = `${state.prologueIndex + 1} / ${PROLOGUE_SCENES.length}`;
  document.getElementById("prologue-title").textContent = scene.title;
  document.getElementById("prologue-text").innerHTML = formatHighlightedDialogue(scene.text);
  document.getElementById("btn-prologue-next").textContent =
    state.prologueIndex === PROLOGUE_SCENES.length - 1 ? "수사 시작 ▶ [Space]" : "다음 ▶ [Space]";
  drawSceneArt("prologue-art-canvas", scene.art);
}

function advancePrologue() {
  if (state.mode !== GAME_MODE.PROLOGUE) return;
  state.prologueIndex++;
  if (state.prologueIndex >= PROLOGUE_SCENES.length) finishPrologue();
  else renderPrologueScene();
}

function finishPrologue() {
  setGameMode(GAME_MODE.PLAY);
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "none";
  playSfx("door");
  startTutorialStep(1);
}

function triggerMemoryFlashback(key) {
  const scene = FLASHBACK_SCENES[key];
  if (!scene) return;
  setGameMode(GAME_MODE.FLASHBACK);
  playSfx("flashback");
  document.getElementById("flashback-chapter").textContent = scene.chapter;
  document.getElementById("flashback-title").textContent = scene.title;
  document.getElementById("flashback-text").innerHTML = formatHighlightedDialogue(scene.text);
  drawSceneArt("flashback-art-canvas", scene.art);
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "flex";
}

function closeMemoryFlashback() {
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  setGameMode(GAME_MODE.PLAY);
  playSfx("clue");
}

function changeSanity(delta, reason = "", silent = false, gameOverTitle = "정신 붕괴", gameOverReason = "끝없는 환청과 공포에 짓눌린 강현우는 결국 13층의 어둠 속에서 자아를 잃고 말았다.") {
  if (state.mode === GAME_MODE.ENDED) return;
  state.sanity = Math.max(SANITY_CONFIG.MIN, Math.min(SANITY_CONFIG.MAX, state.sanity + delta));
  if (!silent) {
    if (delta < 0) {
      state.screenShake = Math.min(12, Math.abs(delta));
      if (reason) addLog(`정신력 ${delta} (${reason})`);
    } else if (delta > 0 && reason) {
      addLog(`정신력 +${delta} (${reason})`);
    }
  }
  markHudDirty();
  if (state.sanity <= SANITY_CONFIG.MIN) {
    triggerGameOver(gameOverTitle, gameOverReason);
  }
}

function useConsumable(type) {
  if (state.mode !== GAME_MODE.PLAY) return;
  if (type === "sedative") {
    if ((state.inventory.sedative || 0) <= 0) {
      say("SYSTEM", "보유한 신경안정제가 없습니다.", "c-system");
      return;
    }
    if (state.sanity >= SANITY_CONFIG.MAX) {
      say("강현우", "지금은 정신이 또렷해. 약을 아껴두자.", "c-hero");
      return;
    }
    state.inventory.sedative--;
    changeSanity(SANITY_CONFIG.SEDATIVE_RESTORE, "신경안정제 복용");
    playSfx("item");
    say("강현우", `약을 삼키자 거칠던 호흡이 조금씩 가라앉는다. (정신력 +${SANITY_CONFIG.SEDATIVE_RESTORE})`, "c-hero");
    renderInventoryUI(useConsumable);
  }
}

function toggleSelectClue(id) {
  if (state.mode !== GAME_MODE.PLAY) return;
  const c = CLUES.find(item => item.id === id);
  if (state.selectedClues.includes(id)) {
    state.selectedClues = state.selectedClues.filter(x => x !== id);
  } else {
    if (state.selectedClues.length >= 2) state.selectedClues.shift();
    state.selectedClues.push(id);
    if (c) {
      const desc = getClueDisplayDescription(c);
      const extraLine = isClueInterpreted(c)
        ? `• [[gold:핵심 해석]]: ${c.importance}`
        : `• [[mint:추리 질문]]: ${c.comboHint}`;
      say("수사 수첩", `[${c.name}]
${desc}

${extraLine}`, "c-clue");
    }
  }
  renderClueUI(toggleSelectClue);
}

function combineSelectedClues() {
  if (state.mode !== GAME_MODE.PLAY) return;
  if (state.selectedClues.length < 2) {
    say("SYSTEM", "수사 수첩에서 서로 연관된 단서 2개를 클릭해 선택한 뒤 조합해 주세요.", "c-system");
    return;
  }
  const [a, b] = state.selectedClues;
  const match = COMBINATIONS.find(c =>
    (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a)
  );

  state.selectedClues = [];
  renderClueUI(toggleSelectClue);

  if (state.tutorialStep === 3) {
    state.tutorialStep = 0;
    renderTutorialBanner();
  }

  if (!match) {
    playSfx("bump");
    changeSanity(SANITY_CONFIG.WRONG_COMBO_PENALTY, "잘못된 추리 조합으로 인한 혼란");
    if (state.mode !== GAME_MODE.ENDED) {
      say("강현우", "억지로 끼워 맞춘 가설이야... 머리가 지끈거린다. 각 단서의 [[mint:추리 질문]]을 다시 읽어보자. (정신력 -5)", "c-hero");
    }
    return;
  }

  if (state.deduced.includes(match.id)) {
    say("SYSTEM", `이미 도출한 진실입니다.

${match.title}
${match.summary}`, "c-system");
    return;
  }

  state.deduced.push(match.id);
  playSfx("combo");

  if (match.id === "combo_space" || match.id === "combo_coverup") {
    unlockDoor1304();
    addLog("13층의 비밀을 파악해 1304호 현관문을 열 수 있게 되었다.");
  } else if (match.id === "combo_secret") {
    state.flags.secretOpen = true;
    addLog("증거 조합으로 아이 방 벽장 뒤 비밀 통로를 여는 방법을 알아냈다!");
  }

  addLog(`새로운 진실 도출: ${match.title}`);
  renderClueUI(toggleSelectClue);
  autoSaveGame();

  if (state.notebookOpen) toggleNotebookDrawer(false);
  say("진실 해금", `증거 조합 성공! 새로운 진실이 수첩에 기록되었다.

${match.title}
${match.summary}`, "c-clue");

  if (match.flashbackKey === "yoonseo" && !state.flags.flashbackYoonseoSeen) {
    state.flags.flashbackYoonseoSeen = true;
    triggerMemoryFlashback("yoonseo");
  } else if (match.flashbackKey === "past" && !state.flags.flashbackPastSeen) {
    state.flags.flashbackPastSeen = true;
    triggerMemoryFlashback("past");
  }
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

function startStep(dx, dy, isSprinting = false) {
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
      handleDoorTransition(door);
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

  if (state.tutorialStep === 1) advanceTutorialStep();
  if (isSprinting) {
    state.stamina = Math.max(0, state.stamina - PLAYER_CONFIG.SPRINT_STEP_COST);
    markHudDirty();
  }
  return true;
}

function updatePlayerMovement(dt) {
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
      checkStepEvents();

      if (state.mode === GAME_MODE.PLAY) {
        const held = getHeldDirection();
        if (held) startStep(held.dx, held.dy, isSprinting);
      }
    } else {
      state.player.px += (dx / dist) * step;
      state.player.py += (dy / dist) * step;
    }
  } else {
    state.player.walkTimer = 0;
    const held = getHeldDirection();
    if (held) startStep(held.dx, held.dy, isSprinting);
  }

  if ((!state.player.moving || !isSprinting) && state.stamina < 100) {
    state.stamina = Math.min(100, state.stamina + PLAYER_CONFIG.STAMINA_REGEN * dt);
    markHudDirty();
  }
}

function handleDoorTransition(door) {
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
        addLog("13층의 비밀을 파악하고 굳게 닫혀 있던 1304호 현관문을 열었다.");
      }
    } else {
      say("SYSTEM", "1304호 철문이 굳게 잠겨 있다.
[Tab] 수사 수첩에서 13층의 존재와 방화문 봉쇄에 관한 단서들을 조합해 진실을 밝혀야 한다.", "c-system");
      return;
    }
  }

  if (door.secret && !state.flags.secretOpen) {
    if (state.deduced.includes("combo_secret")) {
      state.flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤의 비밀 통로가 열렸다!");
    } else {
      say("SYSTEM", "벽장 뒤에서 차가운 바람이 새어 나오지만 굳게 막혀 있다.
[Tab] 수사 수첩에서 관련 단서들을 조합해 벽장 뒤의 진실을 먼저 밝혀야 한다.", "c-system");
      return;
    }
  }

  const prevRoom = state.currentRoom;
  state.currentRoom = door.to;
  state.player.x = door.tx;
  state.player.y = door.ty;
  syncPlayerPixelToGrid();
  snapCamera();
  playSfx("door");
  markHudDirty();

  if (state.currentRoom === "엘리베이터") {
    state.elevatorFloor = prevRoom === "지하 주차장" ? "지하 주차장" : (prevRoom === "13층 복도" ? "13층 복도" : "1층 복도");
    openElevatorMenu();
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
      changeSanity(SANITY_CONFIG.ESCAPE_REWARD, "연속 구역 이탈로 추격 따돌림");
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
    say("SYSTEM", `${state.currentRoom}에 들어왔다.`, "c-system");
    autoSaveGame();
  }

  if (state.currentRoom === "1304호 숨겨진 방" && !state.flags.visitedSecret) {
    state.flags.visitedSecret = true;
    changeSanity(-6, "숨겨진 방의 음산한 기운");
  }
}

function openElevatorMenu() {
  say(
    "SYSTEM",
    `엘리베이터 내부다. 현재 층: [${state.elevatorFloor}]
조작반 맨 아래에는 도면에 없는 붉은색 [13층] 버튼이 희미하게 빛나고 있다.`,
    "c-system",
    [
      {
        label: "1층 복도로 이동",
        action: () => {
          state.currentRoom = "1층 복도";
          state.lightState = "on";
          state.player.x = 17; state.player.y = 3; state.player.dir = "left";
          syncPlayerPixelToGrid(); snapCamera(); playSfx("door");
          say("SYSTEM", "엘리베이터 문이 열리고 1층 복도로 나왔다.", "c-system");
          autoSaveGame(); markHudDirty();
        }
      },
      {
        label: "지하 주차장으로 이동",
        action: () => {
          state.currentRoom = "지하 주차장";
          state.lightState = "on";
          state.player.x = 10; state.player.y = 2; state.player.dir = "down";
          syncPlayerPixelToGrid(); snapCamera(); playSfx("door");
          say("SYSTEM", "축축한 곰팡이 냄새가 진동하는 지하 주차장에 도착했다.", "c-system");
          autoSaveGame(); markHudDirty();
        }
      },
      {
        label: "붉은 [13층] 버튼을 누른다",
        action: () => {
          state.currentRoom = "13층 복도";
          state.lightState = "on";
          state.player.x = 2; state.player.y = 4; state.player.dir = "right";
          syncPlayerPixelToGrid(); snapCamera(); playSfx("ghost");
          if (!state.flags.visited13F) {
            state.flags.visited13F = true;
            changeSanity(-7, "존재하지 않는 13층 진입");
            addLog("엘리베이터가 굉음을 내며 멈추고, 13층 복도가 모습을 드러냈다.");
          }
          say("강현우", "분명 도면엔 12층까지밖에 없었는데... 복도 형광등이 불안하게 윙윙거리고 있어.", "c-hero");
          autoSaveGame(); markHudDirty();
        }
      }
    ]
  );
  markHudDirty();
}

function toggleHide() {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return;
  const r = ROOMS[state.currentRoom];
  if (state.isHiding) {
    if (state.ghost.state !== GHOST_STATE.IDLE || state.lightState === "flicker") {
      say("SYSTEM", "아직 바깥에 추격자의 발소리가 남아 있습니다! 불이 다시 켜질 때까지 숨을 죽이세요.", "c-ghost");
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
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼지만 추격자가 주변을 수색한다!${repeatWarn} 지금 즉시 [[blue:[Space]]]를 연타해 숨을 참으세요!`, "c-ghost");
  } else {
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼다.${repeatWarn} 불이 꺼지고 추격자가 다가오면 [[blue:[Space]]]를 눌러 숨을 참으세요.`, "c-system");
  }
  markHudDirty();
}

function checkStepEvents() {
  if (state.mode !== GAME_MODE.PLAY || state.ghost.state !== GHOST_STATE.IDLE) return;

  const ghostCallbacks = {
    addLog,
    say,
    onTutorial4: () => startTutorialStep(4)
  };

  if (state.currentRoom === "지하 주차장" && state.collected.includes("car_memo") && !state.flags.parkingGhostSeen && state.player.x >= 12) {
    state.flags.parkingGhostSeen = true;
    startGhostWarning(
      "지하 주차장", 18, 4,
      "지하 주차장 형광등이 지지직거리며 심하게 깜빡이기 시작했다! 콘크리트 기둥이나 기계실 격벽 뒤에 숨거나 1층 계단으로 빠르게 벗어나라 [H]!",
      "형광등이 펑 하고 터지며 정전되었다! 어둠 속에서 13번째 방문자가 발소리를 울리며 다가온다!",
      ghostCallbacks
    );
    return;
  }

  if (state.currentRoom === "13층 복도" && state.collected.length >= 4 && !state.flags.hallGhostSeen && state.player.x >= 11 && state.player.x <= 18) {
    state.flags.hallGhostSeen = true;
    startGhostWarning(
      "13층 복도", 22, 4,
      "13층 복도의 형광등이 불규칙하게 점멸하며 스파크가 튄다! 서둘러 은신처를 찾거나 문을 통해 구역을 벗어나라 [H]!",
      "복도 조명이 완전히 꺼졌다! 암전 속에서 13번째 방문자가 거친 숨소리와 함께 달려온다!",
      ghostCallbacks
    );
    return;
  }

  if (state.currentRoom === "1304호 안방" && state.collected.includes("medical") && !state.flags.masterGhostSeen && state.player.x <= 6) {
    state.flags.masterGhostSeen = true;
    startGhostWarning(
      "1304호 안방", 13, 4,
      "안방 형광등이 격렬하게 깜빡이기 시작한다! 붙박이장 안에 숨거나 문을 통해 거실로 벗어나라 [H]!",
      "안방 불이 꺼지며 어둠 속에서 13번째 방문자가 솟아올랐다!",
      ghostCallbacks
    );
    return;
  }

  if (state.currentRoom === "1304호 거실" && state.collected.includes("ledger") && !state.flags.houseGhostSeen) {
    state.flags.houseGhostSeen = true;
    startGhostWarning(
      "1304호 거실", 15, 4,
      "현관 쪽에서 세 번의 노크 소리가 울리더니 거실 형광등이 심하게 깜빡인다! 시야 밖 은신처에 숨거나 복도로 벗어나라 [H]!",
      "거실 불이 완전히 꺼졌다! 정전된 거실로 13번째 방문자가 들이닥쳤다!",
      ghostCallbacks
    );
  }
}

function findInteractableAt(tx, ty) {
  const r = ROOMS[state.currentRoom];
  if (!r) return null;

  const door = r.doors.find(d => d.x === tx && d.y === ty && (!d.secret || state.flags.secretOpen));
  if (door) return { type: "door", target: door, x: door.x, y: door.y };

  if (state.currentRoom === "엘리베이터" && tx === 9 && (ty === 3 || ty === 4)) {
    return { type: "elevator_panel", x: 9, y: ty };
  }

  const npc = NPCS.find(n => n.room === state.currentRoom && n.x === tx && n.y === ty);
  if (npc) return { type: "npc", target: npc, x: npc.x, y: npc.y };

  const clue = CLUES.find(c => c.room === state.currentRoom && !state.collected.includes(c.id) && c.x === tx && c.y === ty);
  if (clue) return { type: "clue", target: clue, x: clue.x, y: clue.y };

  const fItem = FIELD_ITEMS.find(it => it.room === state.currentRoom && !state.pickedFieldItems.includes(it.id) && it.x === tx && it.y === ty);
  if (fItem) return { type: "item", target: fItem, x: fItem.x, y: fItem.y };

  if (state.currentRoom === "1304호 숨겨진 방" && tx === 8 && ty === 2) {
    return { type: "mirror", x: 8, y: 2 };
  }

  const prop = PROPS.find(p => p.room === state.currentRoom && p.x === tx && p.y === ty);
  if (prop) return { type: "prop", target: prop, x: prop.x, y: prop.y };

  const spot = r.hidingSpots.find(s => s.x === tx && s.y === ty);
  if (spot) return { type: "hiding", target: spot, x: spot.x, y: spot.y };

  if (state.currentRoom === "1304호 아이 방" && tx === 14 && ty === 4 && !state.flags.secretOpen) {
    return { type: "secret_wall", x: 14, y: 4 };
  }

  return null;
}

function getBestInteractTarget() {
  const facing = getFacingTile();
  const frontHit = findInteractableAt(facing.x, facing.y);
  if (frontHit) return frontHit;

  const underHit = findInteractableAt(state.player.x, state.player.y);
  if (underHit && underHit.type !== "door") return underHit;

  for (const d of ["down", "up", "left", "right"]) {
    if (d === state.player.dir) continue;
    const { dx, dy } = dirToDelta(d);
    const sideHit = findInteractableAt(state.player.x + dx, state.player.y + dy);
    if (sideHit && sideHit.type !== "door") return sideHit;
  }
  return null;
}

function interact() {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return;
  if (state.isHiding) {
    toggleHide();
    return;
  }

  const hit = getBestInteractTarget();
  if (!hit) {
    say("강현우", "주변을 꼼꼼히 살펴보았지만 더 이상 특이한 점은 보이지 않는다.", "c-hero");
    return;
  }

  if (state.tutorialStep === 2) advanceTutorialStep();

  if (hit.x !== state.player.x || hit.y !== state.player.y) {
    const dx = hit.x - state.player.x;
    const dy = hit.y - state.player.y;
    state.player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  }

  if (hit.type === "door") { handleDoorTransition(hit.target); return; }
  if (hit.type === "elevator_panel") { openElevatorMenu(); return; }

  if (hit.type === "npc") {
    const opp = { up: "down", down: "up", left: "right", right: "left" };
    hit.target.dir = opp[state.player.dir] || "down";
    talkToNPC(hit.target);
    return;
  }

  if (hit.type === "clue") {
    const clue = hit.target;
    state.collected.push(clue.id);
    playSfx("clue");
    addLog(`단서 획득: [${clue.name}]`);
    renderClueUI(toggleSelectClue);

    if (state.collected.length === 2 && !state.flags.tutorialStep3Shown && !state.flags.tutorialDone) {
      state.flags.tutorialStep3Shown = true;
      startTutorialStep(3);
    }

    say(
      "중요 단서",
      `[${clue.name}]을(를) 발견했다!

${getClueDisplayDescription(clue)}

• [[mint:추리 질문]]: ${clue.comboHint}`,
      "c-clue"
    );

    if (clue.id === "recording" || clue.id === "ledger") {
      changeSanity(-5, "충격적인 진실의 단서");
    }
    autoSaveGame();
    return;
  }

  if (hit.type === "item") {
    const fItem = hit.target;
    state.pickedFieldItems.push(fItem.id);
    state.inventory[fItem.type] = (state.inventory[fItem.type] || 0) + 1;
    playSfx("item");
    addLog(`소지품 획득: [${fItem.name}]`);
    renderInventoryUI(useConsumable);
    autoSaveGame();
    say("SYSTEM", `소지품 [${fItem.name}]을(를) 획득했다!

${fItem.desc}`, "c-system");
    return;
  }

  if (hit.type === "mirror") { triggerFinalMirrorEvent(); return; }

  if (hit.type === "prop") {
    const prop = hit.target;
    const firstTime = !state.examinedProps.includes(prop.id);
    if (firstTime) {
      state.examinedProps.push(prop.id);
      addLog(`현장 조사: [${prop.name}]`);
      if (prop.sanityDelta) changeSanity(prop.sanityDelta, prop.sanityReason);
      if (state.examinedProps.length >= PROPS.length && !state.flags.allPropsExamined) {
        state.flags.allPropsExamined = true;
        changeSanity(SANITY_CONFIG.ALL_PROPS_REWARD, "아파트 전체 현장 정밀 조사 완료");
        addLog(`모든 환경 단서(${PROPS.length}/${PROPS.length})를 조사해 사건의 전체 맥락을 꿰뚫었다!`);
      }
    }
    playSfx("step");
    markHudDirty();
    say(prop.speaker, `[${prop.name}]
${prop.text}`, prop.speakerClass);
    return;
  }

  if (hit.type === "hiding") {
    say("SYSTEM", `[${hit.target.label}]이다. 형광등이 깜빡이면 추격자의 시야 밖에서 [H] 키를 눌러 숨을 수 있다.`, "c-system");
    return;
  }

  if (hit.type === "secret_wall") {
    if (state.deduced.includes("combo_secret")) {
      state.flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤 숨겨진 방의 문을 열었다.");
      say("SYSTEM", "도출해낸 진실을 바탕으로 벽장 뒤편을 밀자, 숨겨진 방으로 이어지는 비밀 문이 열렸다!", "c-system");
    } else {
      say("강현우", "벽장 뒤에서 서늘한 바람이 새어 나와. 먼저 [Tab] 수사 수첩에서 관련 단서들을 조합해 비밀을 밝혀야겠어.", "c-hero");
    }
  }
}

function once(flagName, action) {
  return () => {
    if (state.flags[flagName]) return;
    state.flags[flagName] = true;
    action();
  };
}

function talkToNPC(npc) {
  if (npc.id === "park") {
    const choices = [
      {
        label: "1985년 1304호 실종 사건에 대해 묻는다",
        action: () => {
          state.flags.talkedPark = true;
          addLog("경비원 박만식에게 1985년 실종 사건의 초기 증언을 들었다.");
          say("박만식 (경비원)", "1985년 10월 13일 밤이었지... 비명이 들려서 올라갔을 땐 집 안이 텅 비어 있었어. 비상구 앞에서 울고 있던 열다섯 살 소년 하나만 구조됐지.", "c-npc");
        }
      },
      {
        label: "사건 당일 출동했던 경찰 차량에 대해 묻는다",
        action: () => {
          state.flags.askedParkCar = true;
          addLog("박만식으로부터 지하 주차장에 방치된 옛 순찰차 이야기를 들었다.");
          say("박만식 (경비원)", "그날 선임 순경 한 분이 실종되면서 함께 온 지원 순찰차가 지하 주차장 구석에 방치됐었소... 유류품 정리가 덜 된 채 그대로 있을지도 모르지.", "c-npc");
        }
      }
    ];

    if ((state.collected.includes("blueprint") || state.collected.includes("guard_log")) && !state.deduced.includes("combo_coverup")) {
      choices.push({
        label: "[증거 제시] 경비실의 서류 한 장을 내밀며 추궁한다",
        action: () => {
          say("박만식 (경비원)", "서류 한 장 가지고 뭘 어쩌겠다는 거요? 오래된 착오일 뿐이오! 13층 방화문 같은 건 기록에도 없소!", "c-npc");
        }
      });
    }

    if (state.deduced.includes("combo_coverup")) {
      choices.push({
        label: "[2단계 추궁] 준공 도면과 근무일지를 대조한 [진실 2]를 제시한다",
        action: () => {
          state.flags.parkStage2 = true;
          unlockDoor1304();
          addLog("박만식이 1985년 방화문 시건과 출입 기록 파기를 일부 인정했다.");
          say("박만식 (경비원)", "...두 기록을 맞췄군. 맞아, 그날 밤 1304호 아버지가 망상에 미쳐 가족을 가뒀어. 난 겁이 나서 방화문을 잠그고 신고를 늦췄지. 하지만 그날 밤 현장에 있던 소년이 누구였는지는 말할 수 없소...", "c-npc");
        }
      });
    }

    if (
      state.flags.parkStage2 &&
      !state.flags.parkConfessed &&
      (state.deduced.includes("combo_past") || state.collected.includes("ledger"))
    ) {
      choices.push({
        label: "[3단계 완전 자백] 방문자 명부와 강 순경 아들의 진실을 내민다",
        action: once("parkConfessed", () => {
          changeSanity(10, "박만식의 완전한 참회와 증언");
          addLog("박만식이 강현우와 그의 아버지(강 순경)에 대한 모든 진실을 자백했다.");
          say("박만식 (경비원)", "자네 얼굴을 보니 이제야 알겠구먼... 그날 밤 강 순경님이 윤서를 구하려 13층에 올라갔다가 실종됐고, 아드님만 홀로 살아남았소. 부디 13층의 비극을 끝내주게!", "c-npc");
        })
      });
    }

    say("박만식 (경비원)", "이 밤중에 무슨 일이십니까? 은하아파트는 곧 철거될 건물입니다. 13층 같은 건 애초에 없어요.", "c-npc", choices);
  } else if (npc.id === "han") {
    const choices = [
      {
        label: "밤마다 위층에서 들린다는 발소리에 대해 묻는다",
        action: () => {
          state.flags.talkedHan = true;
          addLog("주민 한미정에게 매일 밤 11시 47분마다 들리는 울음소리를 들었다.");
          say("한미정 (주민)", "저는 1204호에 살아요. 매일 밤 11시 47분만 되면 천장 위... 13층에서 여자아이 울음소리와 노크 소리가 들려요. 그 직전엔 꼭 복도 형광등이 깜빡거리더라고요.", "c-npc");
        }
      }
    ];

    if (!state.flags.hanTruth && (state.deduced.includes("combo_yoonseo") || state.collected.includes("medical"))) {
      choices.push({
        label: "[진실 제시] '윤서'라는 아이에 대해 알고 있는지 묻는다",
        action: once("hanTruth", () => {
          changeSanity(6, "한미정의 진심 어린 증언");
          addLog("한미정이 윤서의 옛 피아노 선생이었음을 밝히고 진실을 증언했다.");
          say("한미정 (주민)", "윤서 이름을 어떻게 아세요...? 저는 13년 전 윤서의 피아노 선생님이었어요. 윤서는 착하고 여린 아이였어요. 그날 밤 윤서를 구하러 갔던 한 소년도 있었는데...", "c-npc");
        })
      });
    }

    say("한미정 (주민)", "형사님이신가요...? 제발 저 좀 살려주세요. 12층 위에는 아무것도 없어야 하는데, 누군가 계속 문을 두드려요.", "c-npc", choices);
  } else if (npc.id === "yoonseo") {
    const choices = [
      {
        label: "\"너는 누구니? 왜 이 어두운 복도에 혼자 서 있니?\"",
        action: () => {
          state.flags.metYoonseo = true;
          unlockDoor1304();
          addLog("13층 복도의 소녀 윤서와 대화해 1304호 문을 열 수 있게 되었다.");
          say("윤서", "...아저씨도 13번째 방문자인가요? 우리 집 문은 열어 둘게요. 하지만 형광등이 깜빡이면 꼭 숨어야 해요... 망가진 아빠가 오고 있다는 신호니까요.", "c-npc");
        }
      }
    ];

    if (state.deduced.includes("combo_yoonseo") || state.deduced.includes("combo_past")) {
      if (!state.flags.savedYoonseo) {
        choices.push({
          label: "\"윤서야, 이제 무서워하지 마. 그날 밤의 진실을 모두 기억해냈어.\"",
          action: once("savedYoonseo", () => {
            unlockDoor1304();
            setGhostState(GHOST_STATE.IDLE);
            state.lightState = "on";
            changeSanity(15, "윤서의 원한 완화");
            addLog("윤서에게 진실을 전하여 그녀의 두려움을 진정시켰다.");
            say("윤서", "...정말 기억해 주신 거예요? 13년 동안 아무도 제 목소리를 들어주지 않았어요. 숨겨진 방의 거울을 봐주세요... 모든 진실이 거기 있어요.", "c-npc");
          })
        });
      }
    } else if (!state.flags.provokedYoonseo) {
      choices.push({
        label: "\"원혼이라면 당장 사라져라!\" (적대적으로 경고한다)",
        action: once("provokedYoonseo", () => {
          changeSanity(-18, "13번째 방문자의 분노 촉발");
          if (state.mode === GAME_MODE.ENDED) return;
          startGhostWarning(
            "13층 복도", 22, 4,
            "윤서가 겁에 질려 물러서자 복도 끝에서 무거운 발소리와 함께 형광등이 격렬하게 깜빡이기 시작한다! 은신처를 찾거나 구역을 벗어나라 [H]!",
            "형광등이 산산조각 나며 정전되었다! 광기에 잠식된 13번째 방문자가 비명을 지르며 달려온다!",
            { addLog, say, onTutorial4: () => startTutorialStep(4) }
          );
        })
      });
    }

    say("윤서", "......똑, 똑, 똑. 열두 번까지는 참았는데, 열세 번째 노크가 시작됐어요.", "c-npc", choices);
  }
}

function triggerFinalMirrorEvent() {
  const hasEnoughClues = state.collected.length >= 9;
  const hasTruthCombos = state.deduced.length >= 4 && (state.deduced.includes("combo_yoonseo") || state.deduced.includes("combo_past"));
  const hasHumanConnection = state.flags.savedYoonseo || (state.flags.parkConfessed && state.flags.hanTruth) || state.flags.allPropsExamined;

  say(
    "SYSTEM",
    `방 한가운데 놓인 낡은 거울 속에 1985년 10월 13일의 방이 비치고 있다.
현재 확보 단서: ${state.collected.length}/${CLUES.length} · 도출 진실: ${state.deduced.length}/${COMBINATIONS.length}

등 뒤에서 세 번의 노크 소리가 울린다. 똑. 똑. 똑.
강현우는 마지막 결정을 내려야 한다.`,
    "c-system",
    [
      {
        label: "[진실 직면] 거울 속 13년 전 그날 밤의 기억과 마주한다",
        action: () => {
          if (hasEnoughClues && hasTruthCombos && hasHumanConnection) triggerEnding("TRUE");
          else if (state.collected.length >= 6) triggerEnding("NORMAL");
          else triggerEnding("BAD");
        }
      },
      {
        label: "[사건 봉인] 수집한 기록만 챙겨 1304호의 문을 닫고 떠난다",
        action: () => triggerEnding(state.collected.length >= 5 ? "NORMAL" : "BAD")
      },
      {
        label: "[노크 응답] 문밖에서 들리는 익숙한 목소리를 따라 문을 연다",
        action: () => triggerEnding("BAD")
      }
    ]
  );
}

function triggerEnding(type) {
  setGameMode(GAME_MODE.ENDED);
  state.endingType = type;
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = "on";
  recordEndingUnlock(type);
  updateHUD(true);

  if (type === "TRUE") {
    playSfx("combo");
    addLog("엔딩 달성: [TRUE END - 마지막 방문자와 사라진 가족의 진실]");
    say(
      "TRUE END — 마지막 방문자와 사라진 가족의 진실",
      "거울이 산산조각 나며 봉인되어 있던 13년 전의 기억이 완전히 되살아났다.

1985년 10월 13일, 아버지의 광기 속에서 윤서를 구하려다 비상구 앞에 쓰러졌던 소년이 바로 강현우 자신이었다. 윤서는 악령이 아니라, 자신을 기억해 줄 마지막 방문자를 13년 동안 기다려 온 소녀의 영혼이었다.

강현우가 윤서의 이름을 부르며 진실을 세상에 밝히겠다고 맹세하자, 13층의 붉은 어둠이 걷히고 방문자 명부의 마지막 줄이 사라졌다.",
      "c-clue",
      [
        { label: "처음부터 다시 플레이하기", action: () => startNewGameWithConfirm(true, false) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  } else if (type === "NORMAL") {
    playSfx("door");
    addLog("엔딩 달성: [NORMAL END - 봉인된 미제 사건]");
    say(
      "NORMAL END — 봉인된 미제 사건",
      "강현우는 확보한 물증만을 토대로 1304호 일가족 실종 사건의 수사 보고서를 제출했다.

사건은 서류상 해결되었지만, 윤서의 진실과 강현우 자신의 잃어버린 기억은 끝내 밝혀지지 않았다. 1년 뒤인 1999년 10월 13일 밤 11시 47분, 현관문 앞에서 다시 세 번의 노크 소리가 들려왔다.",
      "c-system",
      [
        { label: "진실을 밝히기 위해 다시 도전하기", action: () => startNewGameWithConfirm(false, false) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  } else {
    playSfx("ghost");
    addLog("엔딩 달성: [BAD END - 13번째 방문자]");
    say(
      "BAD END — 13번째 방문자",
      "진실을 깨닫지 못한 채 문을 연 순간, 등 뒤의 복도가 어둠 속으로 사라졌다.

방문자 명부의 13번째 칸에 적힌 '강현우'라는 이름이 붉게 물든다. 이제 강현우는 다음 형사가 찾아올 때까지 존재하지 않는 13층 복도를 배회하는 13번째 방문자가 되었다.",
      "c-ghost",
      [
        { label: "처음부터 다시 플레이하기", action: () => startNewGameWithConfirm(false, false) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  }
}

function triggerGameOver(title, reason) {
  if (state.mode === GAME_MODE.ENDED) return;
  setGameMode(GAME_MODE.ENDED);
  state.endingType = null;
  setGhostState(GHOST_STATE.IDLE);
  playSfx("ghost");
  updateHUD(true);
  addLog(`GAME OVER - ${title}`);

  const choices = [];
  if (hasValidSaveData()) choices.push({ label: "마지막 저장 불러오기", action: loadGame });
  choices.push({ label: "새 게임 시작", action: () => startNewGameWithConfirm(false, false) });
  choices.push({ label: "타이틀 화면으로 이동", action: returnToTitle });

  say(`GAME OVER — ${title}`, `${reason}

은하아파트 13층의 기록에는 또 한 명의 실종자가 추가되었다.`, "c-ghost", choices);
}

function refreshTitleScreen() {
  const preview = document.getElementById("save-preview");
  const loadBtn = document.getElementById("btn-title-load");
  const raw = safeGet("visitorSave");
  const unlocked = getUnlockedEndings();
  const storageNotice = isStorageRestricted() ? " · (브라우저 저장 제한: 임시 메모리 모드)" : "";

  if (!raw) {
    if (preview) preview.textContent = `저장된 데이터 없음 · 달성 엔딩: ${unlocked.length}/3${storageNotice}`;
    if (loadBtn) loadBtn.disabled = true;
  } else {
    try {
      const data = JSON.parse(raw);
      const rName = data.currentRoom || data.room || "1층 복도";
      const cCount = Array.isArray(data.collected) ? data.collected.length : 0;
      const dCount = Array.isArray(data.deduced) ? data.deduced.length : 0;
      const savedAt = data.savedAt ? ` (${data.savedAt})` : "";
      if (preview) preview.textContent = `저장 기록: [${rName}] 단서 ${cCount}개 · 진실 ${dCount}개${savedAt} · 엔딩: ${unlocked.length}/3${storageNotice}`;
      if (loadBtn) loadBtn.disabled = false;
    } catch (e) {
      if (preview) preview.textContent = "저장 데이터를 읽을 수 없습니다.";
      if (loadBtn) loadBtn.disabled = true;
    }
  }
}

function saveGame() {
  if (state.mode === GAME_MODE.ENDED) {
    say("SYSTEM", "이미 엔딩 또는 게임 오버에 도달한 상태입니다.", "c-system");
    return;
  }
  if (state.ghost.state !== GHOST_STATE.IDLE) {
    playSfx("bump");
    say("SYSTEM", "형광등이 점멸하거나 추격자가 쫓아오는 위기 상황 중에는 저장할 수 없습니다!", "c-ghost");
    return;
  }
  const data = buildSavePayload();
  const persisted = safeSet("visitorSave", JSON.stringify(data));
  playSfx("clue");
  if (persisted) {
    addLog(`현재 수사 진행 상황을 저장했다. (${data.savedAt})`);
    say("SYSTEM", `수사 진행 상황이 안전하게 저장되었습니다. (${data.savedAt})`, "c-system");
  } else {
    addLog(`브라우저 저장소 제한으로 현재 세션 메모리에 임시 저장했다. (${data.savedAt})`);
    say("SYSTEM", `브라우저 저장소가 제한되어 현재 탭의 임시 메모리에 저장되었습니다. (${data.savedAt})`, "c-system");
  }
}

function loadGame() {
  const raw = safeGet("visitorSave");
  if (!raw) {
    say("SYSTEM", "저장된 데이터가 없습니다. 새 게임을 시작해 주세요.", "c-system");
    return;
  }
  try {
    const data = JSON.parse(raw);
    applyLoadedData(data, (room, x, y) => findNearestWalkable(room, x, y, NPCS), snapCamera);
    renderTutorialBanner();
    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";

    renderInventoryUI(useConsumable);
    renderClueUI(toggleSelectClue);
    updateHUD(true);
    addLog("저장된 데이터를 불러왔다.");
    say("SYSTEM", "저장된 수사 기록을 성공적으로 불러왔습니다.", "c-system");
  } catch (e) {
    say("SYSTEM", "저장 데이터를 읽는 중 오류가 발생했습니다.", "c-system");
  }
}

function startNewGameWithConfirm(withPrologue = false, hideTitleOverlay = false) {
  if (hasValidSaveData()) {
    const ok = window.confirm("기존 저장 데이터가 있습니다. 새 게임을 시작하시겠습니까?
(방 이동이나 단서 획득 시 기존 저장 데이터가 덮어씌워집니다.)");
    if (!ok) return false;
  }
  if (hideTitleOverlay) {
    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";
  }
  resetGame(withPrologue);
  return true;
}

function resetGame(withPrologue = false) {
  resetStateFields(snapCamera);
  renderTutorialBanner();
  const logEl = document.getElementById("event-log");
  if (logEl) logEl.innerHTML = "";
  renderInventoryUI(useConsumable);
  renderClueUI(toggleSelectClue);
  updateHUD(true);
  addLog("1998년 10월 13일 23:47, 은하아파트 수사를 시작했다.");
  say("강현우", "여기가 은하아파트 1층 복도인가... 가구와 주변 사물에 가까이 다가가 돋보기가 뜨면 [E]로 조사해 보자.", "c-hero");
  if (withPrologue) startPrologue();
}

function returnToTitle() {
  setGameMode(GAME_MODE.TITLE);
  state.activeChoices = [];
  toggleNotebookDrawer(false);
  const pov = document.getElementById("prologue-overlay");
  if (pov) pov.style.display = "none";
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = "on";
  refreshTitleScreen();
  updateHUD(true);
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "flex";
}

function openEndingGallery() {
  const box = document.getElementById("ending-gallery-box");
  if (!box) return;
  if (box.style.display === "block") { box.style.display = "none"; return; }
  const unlocked = getUnlockedEndings();
  const defs = [
    { key: "TRUE", title: "TRUE END — 마지막 방문자와 사라진 가족의 진실", hint: "조건: 단서 9개 이상 + 핵심 진실 4개 이상(윤서/과거 기억) + 인물과 진실 공유 후 거울 직면" },
    { key: "NORMAL", title: "NORMAL END — 봉인된 미제 사건", hint: "조건: 단서 5~6개 이상 확보 후 거울 직면 또는 사건 기록 봉인" },
    { key: "BAD", title: "BAD END — 13번째 방문자", hint: "조건: 진실이 불충분한 상태에서 노크 소리에 속아 문을 연다" }
  ];
  box.innerHTML = defs.map(d => {
    const ok = unlocked.includes(d.key);
    return `<div class="ending-gallery-item">
      <div class="${ok ? "ending-unlocked" : "ending-locked"}">${ok ? "★ 달성" : "🔒 미달성"} · ${d.title}</div>
      <div style="color:#d6d9e6; font-size:11px;">${d.hint}</div>
    </div>`;
  }).join("");
  box.style.display = "block";
}

let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  updateVisualTimers(dt);

  if (state.mode === GAME_MODE.PLAY) {
    updatePlayerMovement(dt);
    updateCamera(dt);
    updateHallucinations(dt, { addLog });

    if (state.lightState === "out" && !state.isHiding) {
      changeSanity(
        -SANITY_CONFIG.DARK_DRAIN_PER_SEC * dt,
        "",
        true,
        "어둠 속의 공황",
        "칠흑 같은 정전 속에서 버티지 못한 강현우는 끝내 정신을 잃고 말았다."
      );
    }

    updateLightingAndGhost(dt, NPCS, {
      addLog,
      say,
      changeSanity,
      triggerGameOver,
      onTutorial4: () => startTutorialStep(4)
    });
    updateHUD();
  }

  renderGame(ctx, canvas, getBestInteractTarget);
  requestAnimationFrame(gameLoop);
}

function bindUIEvents() {
  document.getElementById("btn-title-new")?.addEventListener("click", () => {
    initAudio();
    startNewGameWithConfirm(true, true);
  });

  document.getElementById("btn-title-load")?.addEventListener("click", () => {
    initAudio();
    document.getElementById("title-overlay").style.display = "none";
    loadGame();
  });

  document.getElementById("btn-title-gallery")?.addEventListener("click", openEndingGallery);
  document.getElementById("btn-prologue-skip")?.addEventListener("click", finishPrologue);
  document.getElementById("btn-prologue-next")?.addEventListener("click", advancePrologue);
  document.getElementById("btn-flashback-close")?.addEventListener("click", closeMemoryFlashback);

  document.getElementById("btn-notebook")?.addEventListener("click", () => toggleNotebookDrawer());
  document.getElementById("btn-drawer-close")?.addEventListener("click", () => toggleNotebookDrawer(false));
  document.getElementById("btn-combine")?.addEventListener("click", combineSelectedClues);

  document.getElementById("btn-minimap")?.addEventListener("click", () => {
    state.showMinimap = !state.showMinimap;
    playSfx("switch");
    document.getElementById("btn-minimap").textContent = "미니맵: " + (state.showMinimap ? "ON" : "OFF");
  });

  document.getElementById("btn-sound")?.addEventListener("click", () => {
    const on = toggleSound();
    document.getElementById("btn-sound").textContent = "사운드: " + (on ? "ON" : "OFF");
  });

  const handleToggleMotion = () => {
    setReducedMotion(!state.prefs.reducedMotion);
    playSfx("switch");
    updateHUD(true);
  };
  document.getElementById("btn-motion")?.addEventListener("click", handleToggleMotion);
  document.getElementById("btn-title-motion")?.addEventListener("click", handleToggleMotion);

  document.getElementById("btn-save")?.addEventListener("click", saveGame);
  document.getElementById("btn-load")?.addEventListener("click", loadGame);
  document.getElementById("btn-title")?.addEventListener("click", returnToTitle);

  document.getElementById("btn-act-interact")?.addEventListener("click", interact);
  document.getElementById("btn-act-hide")?.addEventListener("click", toggleHide);
  document.getElementById("btn-use-sedative")?.addEventListener("click", () => useConsumable("sedative"));

  document.querySelectorAll("[data-pad]").forEach(btn => {
    const dir = btn.getAttribute("data-pad");
    const release = () => { state.padKeys[dir] = false; };
    btn.addEventListener("pointerdown", () => { if (state.mode === GAME_MODE.PLAY) state.padKeys[dir] = true; });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  });
}

document.addEventListener("keydown", e => {
  const code = e.code;

  if (state.mode === GAME_MODE.PROLOGUE) {
    if (["Space", "Enter", "KeyE", "Escape"].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (code === "Escape") finishPrologue();
    else if (code === "Space" || code === "Enter" || code === "KeyE") advancePrologue();
    return;
  }

  if (state.mode === GAME_MODE.FLASHBACK) {
    if (["Space", "Enter", "KeyE", "Escape"].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (["Space", "Enter", "KeyE", "Escape"].includes(code)) closeMemoryFlashback();
    return;
  }

  if ((state.mode === GAME_MODE.DIALOGUE || state.mode === GAME_MODE.ENDED) && state.activeChoices.length > 0) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (code.startsWith("Digit")) {
      const idx = parseInt(code.replace("Digit", ""), 10) - 1;
      if (state.activeChoices[idx]) {
        e.preventDefault();
        const chosen = state.activeChoices[idx];
        state.activeChoices = [];
        const chBox = document.getElementById("choices");
        if (chBox) chBox.innerHTML = "";
        if (state.mode === GAME_MODE.DIALOGUE) setGameMode(GAME_MODE.PLAY);
        chosen.action();
      }
    }
    return;
  }

  if (code === "Tab" && state.mode === GAME_MODE.PLAY) {
    e.preventDefault();
    if (!e.repeat) toggleNotebookDrawer();
    return;
  }

  if (code === "Escape" && state.notebookOpen) {
    e.preventDefault();
    toggleNotebookDrawer(false);
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
    e.preventDefault();
  }
  state.keys[code] = true;

  if (e.repeat || state.mode !== GAME_MODE.PLAY || state.notebookOpen) return;

  if (state.isHiding && state.breathHold.active && code === "Space") {
    holdBreathAction();
    return;
  }

  if (code === "KeyE" || code === "Space") interact();
  else if (code === "KeyH") toggleHide();
  else if (code === "KeyM") {
    state.showMinimap = !state.showMinimap;
    playSfx("switch");
  } else if (code === "KeyC") combineSelectedClues();
  else if (code === "KeyQ") useConsumable("sedative");
});

document.addEventListener("keyup", e => {
  state.keys[e.code] = false;
});

window.addEventListener("blur", clearHeldInputs);

bindUIEvents();
snapCamera();
refreshTitleScreen();
renderInventoryUI(useConsumable);
renderClueUI(toggleSelectClue);
updateHUD(true);
requestAnimationFrame(gameLoop);
