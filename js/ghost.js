/* =========================================================================
   4. 원혼 AI(정수 인덱스 BFS) · 은신 발각 및 숨 참기 미니게임 · 정신력 환각 모듈 (v1.4.2)
   ========================================================================= */
import { ROOMS } from "./data.js";
import {
  TILE, FLICKER_DURATION, GHOST_CONFIG, BREATH_CONFIG, SANITY_CONFIG
} from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE, setGhostState, autoSaveGame, markHudDirty
} from "./state.js";
import { playSfx } from "./audio.js";

const CARDINAL_DIRS = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0]
];

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
  const clampedX = Math.max(1, Math.min(r.cols - 2, sx));
  const clampedY = Math.max(1, Math.min(r.rows - 2, sy));
  if (!isBlocked(roomName, clampedX, clampedY, npcs)) return { x: clampedX, y: clampedY };

  const cols = r.cols;
  const total = cols * r.rows;
  const visited = new Uint8Array(total);
  const queueX = new Int16Array(total);
  const queueY = new Int16Array(total);
  let head = 0;
  let tail = 0;

  visited[clampedY * cols + clampedX] = 1;
  queueX[tail] = clampedX;
  queueY[tail] = clampedY;
  tail++;

  while (head < tail) {
    const cx = queueX[head];
    const cy = queueY[head];
    head++;

    for (let i = 0; i < 4; i++) {
      const nx = cx + CARDINAL_DIRS[i][0];
      const ny = cy + CARDINAL_DIRS[i][1];
      if (nx < 1 || nx > r.cols - 2 || ny < 1 || ny > r.rows - 2) continue;
      const idx = ny * cols + nx;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (!isBlocked(roomName, nx, ny, npcs)) return { x: nx, y: ny };
      queueX[tail] = nx;
      queueY[tail] = ny;
      tail++;
    }
  }
  return { x: 3, y: 4 };
}

export function getNextBfsStep(roomName, startX, startY, goalX, goalY, npcs = []) {
  const r = ROOMS[roomName];
  if (!r || (startX === goalX && startY === goalY)) return { x: goalX, y: goalY };

  const cols = r.cols;
  const rows = r.rows;
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const queueIdx = new Int16Array(total);
  const firstStepIdx = new Int16Array(total);
  let head = 0;
  let tail = 0;

  const startIdx = startY * cols + startX;
  const goalIdx = goalY * cols + goalX;
  visited[startIdx] = 1;
  queueIdx[tail] = startIdx;
  firstStepIdx[tail] = -1;
  tail++;

  while (head < tail) {
    const curIdx = queueIdx[head];
    const curFirst = firstStepIdx[head];
    head++;

    const cx = curIdx % cols;
    const cy = (curIdx - cx) / cols;

    for (let i = 0; i < 4; i++) {
      const nx = cx + CARDINAL_DIRS[i][0];
      const ny = cy + CARDINAL_DIRS[i][1];
      if (nx < 1 || nx > cols - 2 || ny < 1 || ny > rows - 2) continue;

      const nIdx = ny * cols + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;

      const stepIdx = curFirst === -1 ? nIdx : curFirst;
      if (nIdx === goalIdx) {
        return { x: stepIdx % cols, y: Math.floor(stepIdx / cols) };
      }

      if (!isBlocked(roomName, nx, ny, npcs)) {
        queueIdx[tail] = nIdx;
        firstStepIdx[tail] = stepIdx;
        tail++;
      }
    }
  }
  return { x: startX, y: startY };
}

export function beginBreathHoldMinigame(hidingId) {
  const repeatCount = state.hidingUseCount[hidingId] || 1;
  state.breathHold.active = true;
  state.breathHold.gauge = Math.max(
    BREATH_CONFIG.MIN_INITIAL_GAUGE,
    BREATH_CONFIG.BASE_GAUGE - (repeatCount - 1) * BREATH_CONFIG.REPEAT_GAUGE_PENALTY
  );
  state.breathHold.timer = 0;
  state.breathHold.duration = Math.min(
    BREATH_CONFIG.MAX_DURATION,
    BREATH_CONFIG.BASE_DURATION + (repeatCount - 1) * BREATH_CONFIG.REPEAT_DURATION_BONUS
  );
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
  state.ghost.escapePathRooms = [roomName];
  state.ghost.entryDelay = 0;
  state.ghost.lastBfsTileKey = -1;
  state.ghost.cachedBfsStep = null;

  if (!state.flags.tutorialStep4Shown && !state.flags.tutorialDone && callbacks.onTutorial4) {
    state.flags.tutorialStep4Shown = true;
    callbacks.onTutorial4();
  }

  playSfx("flicker");
  callbacks.addLog(warningText);
  callbacks.say("SYSTEM", warningText, "c-system");
  markHudDirty();
}

export function holdBreathAction() {
  if (!state.isHiding || !state.breathHold.active) return false;
  state.breathHold.gauge = Math.min(100, state.breathHold.gauge + BREATH_CONFIG.PRESS_GAIN);
  playSfx("breath");
  return true;
}

export function updateHallucinations(dt, callbacks) {
  if (state.sanity > SANITY_CONFIG.HALLUCINATION_THRESHOLD) {
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
      state.ghost.lastBfsTileKey = -1;
      state.ghost.cachedBfsStep = null;
      state.lightState = "out";
      playSfx("ghost");

      if (state.isHiding) {
        setGhostState(GHOST_STATE.SEARCH);
        beginBreathHoldMinigame(state.currentHidingId);

        callbacks.addLog("형광등이 꺼졌다! 추격자가 은신처 주변을 수색한다 — [Space]로 숨을 참아라!");
        callbacks.say("SYSTEM", "조명이 꺼지고 13번째 방문자가 코앞까지 다가왔다! [[blue:[Space]]] 키를 연타해 숨을 참아라!", "c-ghost");
      } else {
        callbacks.addLog(state.ghost.chaseText);
        callbacks.say("13번째 방문자", state.ghost.chaseText, "c-ghost");
      }
      markHudDirty();
    }
    return;
  }

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

  if (state.isHiding) {
    setGhostState(GHOST_STATE.SEARCH);
    state.ghost.patrolTimer += dt;
    state.ghost.px += Math.sin(state.elapsedTime * 4.8) * 34 * dt;
    state.ghost.py += Math.cos(state.elapsedTime * 3.6) * 24 * dt;

    if (state.breathHold.active) {
      const repeatCount = state.hidingUseCount[state.currentHidingId] || 1;
      const drainRate = BREATH_CONFIG.BASE_DRAIN_RATE + (repeatCount - 1) * BREATH_CONFIG.REPEAT_DRAIN_PENALTY;
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
        markHudDirty();
        return;
      }

      if (state.breathHold.timer >= state.breathHold.duration) {
        state.breathHold.active = false;
        callbacks.addLog("완벽하게 숨을 죽여 추격자의 의심을 피했다.");
      }
    }

    if (state.ghost.patrolTimer >= GHOST_CONFIG.SEARCH_PATROL_DURATION && !state.breathHold.active) {
      setGhostState(GHOST_STATE.IDLE);
      state.lightState = "on";
      playSfx("light_on");
      callbacks.changeSanity(SANITY_CONFIG.HIDE_SUCCESS_REWARD, "은신 및 숨 참기 성공으로 위기 극복");
      callbacks.addLog("13번째 방문자가 어둠 속으로 물러나고, 천장 형광등이 다시 켜졌다.");
      callbacks.say("SYSTEM", "발소리가 멀어지고 지지직거리는 소리와 함께 형광등이 다시 켜졌다!", "c-system");
      markHudDirty();
      autoSaveGame();
    }
    return;
  }

  setGhostState(GHOST_STATE.CHASE);
  const r = ROOMS[state.currentRoom];
  const gxTile = Math.max(1, Math.min(r.cols - 2, Math.round(state.ghost.px / TILE)));
  const gyTile = Math.max(1, Math.min(r.rows - 2, Math.round(state.ghost.py / TILE)));

  const tileKey = ((gyTile * r.cols + gxTile) << 16) | (state.player.y * r.cols + state.player.x);
  if (state.ghost.lastBfsTileKey !== tileKey || !state.ghost.cachedBfsStep) {
    state.ghost.lastBfsTileKey = tileKey;
    state.ghost.cachedBfsStep = getNextBfsStep(state.currentRoom, gxTile, gyTile, state.player.x, state.player.y, npcs);
  }
  const nextStep = state.ghost.cachedBfsStep;

  const targetX = (nextStep.x === state.player.x && nextStep.y === state.player.y) ? state.player.px : nextStep.x * TILE;
  const targetY = (nextStep.x === state.player.x && nextStep.y === state.player.y) ? state.player.py : nextStep.y * TILE;

  const dx = targetX - state.ghost.px;
  const dy = targetY - state.ghost.py;
  const distToStep = Math.hypot(dx, dy);
  const directDist = Math.hypot(state.player.px - state.ghost.px, state.player.py - state.ghost.py);

  const speedTiles = state.ghost.speed + (state.sanity < SANITY_CONFIG.HALLUCINATION_THRESHOLD ? GHOST_CONFIG.LOW_SANITY_BONUS_TILES : 0);
  const speedPx = speedTiles * TILE;

  if (distToStep > 1) {
    state.ghost.px += (dx / distToStep) * speedPx * dt;
    state.ghost.py += (dy / distToStep) * speedPx * dt;
  }

  if (directDist < TILE * GHOST_CONFIG.PROXIMITY_SANITY_DIST_TILES) {
    callbacks.changeSanity(-GHOST_CONFIG.PROXIMITY_SANITY_DRAIN * dt, "", true);
    if (state.mode === GAME_MODE.ENDED) return;
  }

  if (directDist < TILE * GHOST_CONFIG.CATCH_DIST_TILES) {
    callbacks.triggerGameOver("13층의 제물", "제때 숨거나 따돌리지 못한 강현우는 13번째 방문자의 손아귀에 붙잡혀 13층의 어둠 속으로 끌려갔다.");
  }
}
