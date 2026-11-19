/* =========================================================================
   3. 게임 모드 상태 머신(FSM), 원혼 상태 머신 & 세이브/로드 관리
   ========================================================================= */
import { APP_VERSION } from "../version.js";
import { ROOMS } from "./data.js";

export const TILE = 40;
export const FLICKER_DURATION = 10.0;

export const GAME_MODE = Object.freeze({
  TITLE: "TITLE",
  PROLOGUE: "PROLOGUE",
  PLAY: "PLAY",
  DIALOGUE: "DIALOGUE",
  FLASHBACK: "FLASHBACK",
  ENDED: "ENDED"
});

export const GHOST_STATE = Object.freeze({
  IDLE: "IDLE",
  WARNING: "WARNING",
  CHASE: "CHASE",
  SEARCH: "SEARCH"
});

export const state = {
  mode: GAME_MODE.TITLE,
  currentRoom: "1층 복도",
  player: {
    x: 4,
    y: 5,
    px: 4 * TILE,
    py: 5 * TILE,
    dir: "down",
    moving: false,
    walkTimer: 0,
    stepParity: 0
  },
  camera: { x: 0, y: 0 },
  sanity: 100,
  stamina: 100,
  lightState: "on", // "on" | "flicker" | "out"
  flickerTimer: 0,
  flickerSfxCooldown: 0,
  currentLightOn: true,

  collected: [],
  deduced: [],
  selectedClues: [],
  pickedFieldItems: [],
  examinedProps: [],
  inventory: { sedative: 1 },
  flags: {},
  activeChoices: [],

  isHiding: false,
  currentHidingId: "",
  currentHidingLabel: "",
  hidingUseCount: {},
  breathHold: {
    active: false,
    gauge: 65,
    timer: 0,
    duration: 3.5
  },

  endingType: null,
  elevatorFloor: "1층 복도",
  showMinimap: true,
  notebookOpen: false,

  prologueIndex: 0,
  tutorialStep: 0,

  ghost: {
    state: GHOST_STATE.IDLE,
    room: "",
    spawnX: 0,
    spawnY: 0,
    px: 0,
    py: 0,
    speed: 4.85,
    patrolTimer: 0,
    entryDelay: 0,
    heartbeatCooldown: 0,
    chaseText: "",
    escapeRoomCount: 0
  },

  hallucination: {
    fakeClue: null,
    timer: 0
  },

  keys: {},
  padKeys: { up: false, down: false, left: false, right: false },
  bumpCooldown: 0,
  animTick: 0,
  screenShake: 0
};

export function setGameMode(nextMode) {
  state.mode = nextMode;
  if (nextMode !== GAME_MODE.PLAY) {
    clearHeldInputs();
  }
}

export function setGhostState(nextState) {
  state.ghost.state = nextState;
  if (nextState === GHOST_STATE.IDLE) {
    state.ghost.escapeRoomCount = 0;
    state.ghost.entryDelay = 0;
    state.ghost.patrolTimer = 0;
    state.breathHold.active = false;
  }
}

export function clearHeldInputs() {
  Object.keys(state.keys).forEach(k => { state.keys[k] = false; });
  state.padKeys.up = false;
  state.padKeys.down = false;
  state.padKeys.left = false;
  state.padKeys.right = false;
}

export function getUnlockedEndings() {
  try {
    const raw = localStorage.getItem("visitorEndings");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function recordEndingUnlock(type) {
  const list = getUnlockedEndings();
  if (!list.includes(type)) {
    list.push(type);
    localStorage.setItem("visitorEndings", JSON.stringify(list));
  }
}

export function hasValidSaveData() {
  try {
    const raw = localStorage.getItem("visitorSave");
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(data && typeof data === "object");
  } catch (e) {
    return false;
  }
}

export function buildSavePayload() {
  const now = new Date();
  const savedAt = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return {
    version: APP_VERSION,
    savedAt,
    currentRoom: state.currentRoom,
    player: { x: state.player.x, y: state.player.y, dir: state.player.dir },
    sanity: state.sanity,
    stamina: state.stamina,
    collected: state.collected,
    deduced: state.deduced,
    pickedFieldItems: state.pickedFieldItems,
    examinedProps: state.examinedProps,
    inventory: state.inventory,
    flags: state.flags,
    hidingUseCount: state.hidingUseCount
  };
}

export function autoSaveGame() {
  if (state.mode === GAME_MODE.ENDED || state.mode === GAME_MODE.TITLE) return;
  if (state.ghost.state !== GHOST_STATE.IDLE) return;
  try {
    const data = buildSavePayload();
    localStorage.setItem("visitorSave", JSON.stringify(data));
  } catch (e) {}
}

export function applyLoadedData(data, findNearestWalkableFn, snapCameraFn) {
  const legacyRoomMap = {
    "거실": "1304호 거실",
    "안방": "1304호 안방",
    "아이 방": "1304호 아이 방",
    "숨겨진 방": "1304호 숨겨진 방"
  };
  const loadedRoom = data.currentRoom || data.room || "1층 복도";
  state.currentRoom = legacyRoomMap[loadedRoom] || (ROOMS[loadedRoom] ? loadedRoom : "1층 복도");

  const rawPlayer = data.player || { x: 4, y: 5, dir: "down" };
  const safePos = findNearestWalkableFn(state.currentRoom, rawPlayer.x ?? 4, rawPlayer.y ?? 5);
  state.player = {
    x: safePos.x,
    y: safePos.y,
    px: safePos.x * TILE,
    py: safePos.y * TILE,
    dir: rawPlayer.dir || "down",
    moving: false,
    walkTimer: 0,
    stepParity: 0
  };
  snapCameraFn();

  state.sanity = typeof data.sanity === "number" ? Math.max(10, Math.min(100, data.sanity)) : 100;
  state.stamina = typeof data.stamina === "number" ? Math.max(0, Math.min(100, data.stamina)) : 100;
  state.collected = Array.isArray(data.collected) ? data.collected : [];
  state.deduced = Array.isArray(data.deduced) ? data.deduced : [];
  state.pickedFieldItems = Array.isArray(data.pickedFieldItems) ? data.pickedFieldItems : [];
  state.examinedProps = Array.isArray(data.examinedProps) ? data.examinedProps : [];
  state.inventory = data.inventory && typeof data.inventory === "object"
    ? { sedative: data.inventory.sedative ?? 1 }
    : { sedative: 1 };
  state.flags = data.flags || {};
  state.hidingUseCount = data.hidingUseCount || {};

  state.selectedClues = [];
  state.activeChoices = [];
  clearHeldInputs();
  state.isHiding = false;
  state.currentHidingId = "";
  state.currentHidingLabel = "";
  state.breathHold.active = false;
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = state.currentRoom === "1304호 숨겨진 방" ? "out" : "on";
  state.endingType = null;
  state.tutorialStep = 0;
  setGameMode(GAME_MODE.PLAY);
}

export function resetStateFields(snapCameraFn) {
  state.currentRoom = "1층 복도";
  state.player = {
    x: 4,
    y: 5,
    px: 4 * TILE,
    py: 5 * TILE,
    dir: "down",
    moving: false,
    walkTimer: 0,
    stepParity: 0
  };
  snapCameraFn();

  state.sanity = 100;
  state.stamina = 100;
  state.lightState = "on";
  state.flickerTimer = 0;
  state.collected = [];
  state.deduced = [];
  state.selectedClues = [];
  state.pickedFieldItems = [];
  state.examinedProps = [];
  state.inventory = { sedative: 1 };
  state.flags = {};
  state.activeChoices = [];
  clearHeldInputs();
  state.isHiding = false;
  state.currentHidingId = "";
  state.currentHidingLabel = "";
  state.hidingUseCount = {};
  state.breathHold = { active: false, gauge: 65, timer: 0, duration: 3.5 };
  setGhostState(GHOST_STATE.IDLE);
  state.hallucination = { fakeClue: null, timer: 0 };
  state.endingType = null;
  state.tutorialStep = 0;
  setGameMode(GAME_MODE.PLAY);
}
