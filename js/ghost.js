/* =========================================================================
   4. 원혼 AI(BFS 길찾기) · 은신 발각 및 숨 참기 미니게임 · 정신력 환각 모듈
   ========================================================================= */
import { ROOMS } from "./data.js";
import { state, TILE, FLICKER_DURATION, GAME_MODE, GHOST_STATE, setGhostState, autoSaveGame } from "./state.js";
import { playSfx } from "./audio.js";

export function isBlocked(roomName, tx, ty, npcs = []) {
  const r = ROOMS[roomName];
  if (!r) return true;
  if (tx < 1 || tx > r.cols - 2 || ty < 1 || ty > r.rows - 2) return true;

  for (const f of r.furniture) {
    if (tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.h) return true;
  }
  for (const n of npcs) {
    if (n.room === roomName && n.x === tx && n.y === ty) return true;
  }
  return false;
}

export function findNearestWalkable(roomName, sx, sy, npcs = []) {
  const r = ROOMS[roomName];
  if (!r) return { x: 4, y: 4 };
  if (!isBlocked(roomName, sx, sy, npcs)) return { x: sx, y: sy };

  const visited = new Set([`${sx},${sy}`]);
  const queue = [{ x: sx, y: sy }];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (nx >= 1 && nx <= r.cols - 2 && ny >= 1 && ny <= r.rows - 2) {
        if (!isBlocked(roomName, nx, ny, npcs)) return { x: nx, y: ny };
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return { x: 3, y: 4 };
}

export function getNextBfsStep(roomName, startX, startY, goalX, goalY, npcs = []) {
  const r = ROOMS[roomName];
  if (!r || (startX === goalX && startY === goalY)) return { x: goalX, y: goalY };

  const visited = new Set([`${startX},${startY}`]);
  const queue = [{ x: startX, y: startY, firstStep: null }];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (nx === goalX && ny === goalY) {
        return cur.firstStep || { x: nx, y: ny };
      }
      if (!isBlocked(roomName, nx, ny, npcs)) {
        queue.push({
          x: nx,
          y: ny,
          firstStep: cur.firstStep || { x: nx, y: ny }
        });
      }
    }
  }
  return { x: goalX, y: goalY };
}

export function startGhostWarning(roomName, gx, gy, warningText, chaseText, callbacks) {
  if (state.mode === GAME_MODE.ENDED || state.ghost.state !== GHOST_STATE.IDLE) return;

  state.lightState = "flicker";
  state.flickerTimer = FLICKER_DURATION;
  state.flickerSfxCooldown = 0;

  setGhostState(GHOST_STATE.WARNING);
  state.ghost.room = roomName;
  state.ghost.spawnX = gx;
  state.ghost.spawnY = gy;
  state.ghost.chaseText = chaseText;
  state.ghost.escapeRoomCount = 0;
  state.ghost.entryDelay = 0;

  if (!state.flags.tutorialStep4Shown && !state.flags.tutorialDone && callbacks.onTutorial4) {
    state.flags.tutorialStep4Shown = true;
    callbacks.onTutorial4();
  }

  playSfx("flicker");
  callbacks.addLog(warningText);
  callbacks.say("SYSTEM", warningText, "c-system");
  callbacks.updateHUD();
}

export function holdBreathAction() {
  if (!state.isHiding || !state.breathHold.active) return false;
  state.breathHold.gauge = Math.min(100, state.breathHold.gauge + 22);
  playSfx("breath");
  return true;
}

export function updateHallucinations(dt, callbacks) {
  if (state.sanity > 40) {
    state.hallucination.fakeClue = null;
    state.hallucination.timer = 0;
    return;
  }

  state.hallucination.timer -= dt;
  if (state.hallucination.timer <= 0) {
    state.hallucination.timer = 9 + Math.random() * 6;
    const r = ROOMS[state.currentRoom];
    if (r) {
      const fx = 2 + Math.floor(Math.random() * (r.cols - 4));
      const fy = 2 + Math.floor(Math.random() * (r.rows - 4));
      state.hallucination.fakeClue = { x: fx, y: fy, ttl: 5.5 };
      if (Math.random() < 0.45 && callbacks.addLog) {
        callbacks.addLog("환청: 문틈 너머에서 누군가 이름을 부르는 소리가 들린다...");
      }
    }
  }

  if (state.hallucination.fakeClue) {
    state.hallucination.fakeClue.ttl -= dt;
    if (state.hallucination.fakeClue.ttl <= 0) {
      state.hallucination.fakeClue = null;
    }
  }
}

export function updateLightingAndGhost(dt, npcs, callbacks) {
  // 1. 형광등 점멸 전조 카운트다운 (10초)
  if (state.lightState === "flicker" && state.ghost.state === GHOST_STATE.WARNING) {
    state.flickerTimer -= dt;
    state.flickerSfxCooldown -= dt;
    if (state.flickerSfxCooldown <= 0) {
      playSfx("flicker");
      const progress = 1 - Math.max(0, state.flickerTimer / FLICKER_DURATION);
      state.flickerSfxCooldown = Math.max(0.28, 0.68 - progress * 0.4);
    }

    if (state.flickerTimer <= 0) {
      setGhostState(GHOST_STATE.CHASE);
      state.ghost.room = state.currentRoom;
      const safeSpawn = findNearestWalkable(state.currentRoom, state.ghost.spawnX, state.ghost.spawnY, npcs);
      state.ghost.px = safeSpawn.x * TILE;
      state.ghost.py = safeSpawn.y * TILE;
      state.ghost.patrolTimer = 0;
      state.ghost.entryDelay = 0;
      state.lightState = "out";
      playSfx("ghost");

      if (state.isHiding) {
        setGhostState(GHOST_STATE.SEARCH);
        const repeatCount = state.hidingUseCount[state.currentHidingId] || 1;
        state.breathHold.active = true;
        state.breathHold.gauge = Math.max(38, 72 - (repeatCount - 1) * 14);
        state.breathHold.timer = 0;
        state.breathHold.duration = Math.min(5.0, 3.0 + (repeatCount - 1) * 0.6);

        callbacks.addLog("형광등이 꺼졌다! 추격자가 은신처 주변을 수색한다 — [Space]로 숨을 참아라!");
        callbacks.say("SYSTEM", "조명이 꺼지고 13번째 방문자가 코앞까지 다가왔다! [[blue:[Space]]] 키를 연타해 숨을 참아라!", "c-ghost");
      } else {
        callbacks.addLog(state.ghost.chaseText);
        callbacks.say("13번째 방문자", state.ghost.chaseText, "c-ghost");
      }
      callbacks.updateHUD();
    }
    return;
  }

  // 2. 원혼 추격 / 수색 상태 처리
  if ((state.ghost.state !== GHOST_STATE.CHASE && state.ghost.state !== GHOST_STATE.SEARCH) || state.ghost.room !== state.currentRoom) {
    return;
  }

  state.ghost.heartbeatCooldown -= dt;
  if (state.ghost.heartbeatCooldown <= 0) {
    playSfx("heartbeat");
    state.ghost.heartbeatCooldown = 0.9;
  }

  if (state.ghost.entryDelay > 0) {
    state.ghost.entryDelay = Math.max(0, state.ghost.entryDelay - dt);
    return;
  }

  // 은신 중 수색(SEARCH) 및 숨 참기 미니게임
  if (state.isHiding) {
    setGhostState(GHOST_STATE.SEARCH);
    state.ghost.patrolTimer += dt;
    state.ghost.px += Math.sin(state.animTick * 0.08) * 34 * dt;
    state.ghost.py += Math.cos(state.animTick * 0.06) * 24 * dt;

    if (state.breathHold.active) {
      const repeatCount = state.hidingUseCount[state.currentHidingId] || 1;
      const drainRate = 24 + (repeatCount - 1) * 7;
      state.breathHold.gauge = Math.max(0, state.breathHold.gauge - drainRate * dt);
      state.breathHold.timer += dt;

      if (state.breathHold.gauge <= 0) {
        state.breathHold.active = false;
        state.isHiding = false;
        state.currentHidingId = "";
        state.currentHidingLabel = "";
        setGhostState(GHOST_STATE.CHASE);
        playSfx("ghost");
        callbacks.addLog("거친 숨소리를 들켜 은신처 문이 강제로 열렸다!");
        callbacks.say("13번째 방문자", "......찾았다! 숨소리가 새어 나와 은신처가 발각되었다! 당장 도망쳐라!", "c-ghost");
        callbacks.updateHUD();
        return;
      }

      if (state.breathHold.timer >= state.breathHold.duration) {
        state.breathHold.active = false;
        callbacks.addLog("완벽하게 숨을 죽여 추격자의 의심을 피했다.");
      }
    }

    if (state.ghost.patrolTimer >= 5.5 && !state.breathHold.active) {
      setGhostState(GHOST_STATE.IDLE);
      state.lightState = "on";
      playSfx("light_on");
      callbacks.changeSanity(4, "은신 및 숨 참기 성공으로 위기 극복");
      callbacks.addLog("13번째 방문자가 어둠 속으로 물러나고, 천장 형광등이 다시 켜졌다.");
      callbacks.say("SYSTEM", "발소리가 멀어지고 지지직거리는 소리와 함께 형광등이 다시 켜졌다!", "c-system");
      callbacks.updateHUD();
      autoSaveGame();
    }
    return;
  }

  // CHASE 상태: BFS 길찾기 추격
  setGhostState(GHOST_STATE.CHASE);
  const r = ROOMS[state.currentRoom];
  const gxTile = Math.max(1, Math.min(r.cols - 2, Math.round(state.ghost.px / TILE)));
  const gyTile = Math.max(1, Math.min(r.rows - 2, Math.round(state.ghost.py / TILE)));
  const nextStep = getNextBfsStep(state.currentRoom, gxTile, gyTile, state.player.x, state.player.y, npcs);

  const targetX = (nextStep.x === state.player.x && nextStep.y === state.player.y) ? state.player.px : nextStep.x * TILE;
  const targetY = (nextStep.x === state.player.x && nextStep.y === state.player.y) ? state.player.py : nextStep.y * TILE;

  const dx = targetX - state.ghost.px;
  const dy = targetY - state.ghost.py;
  const distToStep = Math.hypot(dx, dy);
  const directDist = Math.hypot(state.player.px - state.ghost.px, state.player.py - state.ghost.py);

  const speedPx = (state.ghost.speed + (state.sanity < 40 ? 0.35 : 0)) * TILE;

  if (distToStep > 1) {
    state.ghost.px += (dx / distToStep) * speedPx * dt;
    state.ghost.py += (dy / distToStep) * speedPx * dt;
  }

  if (directDist < TILE * 3.0) {
    state.sanity = Math.max(0, state.sanity - 5.0 * dt);
    callbacks.updateHUD();
    if (state.sanity <= 0) {
      callbacks.triggerGameOver("정신 붕괴", "13번째 방문자의 광기에 정신을 잠식당한 강현우는 그 자리에서 무너지고 말았다.");
      return;
    }
  }

  if (directDist < TILE * 0.55) {
    callbacks.triggerGameOver("13층의 제물", "제때 숨거나 따돌리지 못한 강현우는 13번째 방문자의 손아귀에 붙잡혀 13층의 어둠 속으로 끌려갔다.");
  }
}
