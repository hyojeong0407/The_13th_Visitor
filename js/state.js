/* =========================================================================
   3. 게임 모드 상태 머신(FSM), 원혼 상태 머신 & 세이브/로드 관리 (v1.4.2)
   ========================================================================= */
import { APP_VERSION } from "../version.js";
import { ROOMS } from "./data.js";
import {
  TILE, GHOST_CONFIG, BREATH_CONFIG, SANITY_CONFIG, UI_CONFIG
} from "./config.js";
import { safeGet, safeSet } from "./storage.js";

export { TILE, FLICKER_DURATION } from "./config.js";

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

function loadInitialPrefs() {
  const systemReduced = typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    const raw = safeGet(UI_CONFIG.PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : systemReduced
      };
    }
  } catch (e) {}
  return { reducedMotion: systemReduced };
}

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
  sanity: SANITY_CONFIG.INITIAL,
  stamina: 100,
  lightState: "on",
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
    gauge: BREATH_CONFIG.BASE_GAUGE,
    timer: 0,
    duration: BREATH_CONFIG.BASE_DURATION
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
    speed: GHOST_CONFIG.BASE_SPEED_TILES,
    patrolTimer: 0,
    entryDelay: 0,
    heartbeatCooldown: 0,
    chaseText: "",
    escapeRoomCount: 0,
    escapePathRooms: [],
    lastBfsTileKey: -1,
    cachedBfsStep: null
  },

  hallucination: {
    fakeClue: null,
    timer: 0
  },

  prefs: loadInitialPrefs(),

  keys: {},
  padKeys: { up: false, down: false, left: false, right: false },
  bumpCooldown: 0,
  elapsedTime: 0,
  screenShake: 0,
  hudDirty: true
};

export function markHudDirty() {
  state.hudDirty = true;
}

export function setReducedMotion(enabled) {
  state.prefs.reducedMotion = Boolean(enabled);
  safeSet(UI_CONFIG.PREFS_STORAGE_KEY, JSON.stringify(state.prefs));
  markHudDirty();
  return state.prefs.reducedMotion;
}

export function isDoor1304Unlocked() {
  return Boolean(
    state.flags.door1304Unlocked ||
    state.deduced.includes("combo_space") ||
    state.deduced.includes("combo_coverup") ||
    state.flags.metYoonseo
  );
}

export function unlockDoor1304() {
  state.flags.door1304Unlocked = true;
}

export function setGameMode(nextMode) {
  state.mode = nextMode;
  if (nextMode !== GAME_MODE.PLAY) {
    clearHeldInputs();
  }
  markHudDirty();
}

export function setGhostState(nextState) {
  state.ghost.state = nextState;
  if (nextState === GHOST_STATE.IDLE) {
    state.ghost.escapeRoomCount = 0;
    state.ghost.escapePathRooms = [];
    state.ghost.entryDelay = 0;
    state.ghost.patrolTimer = 0;
    state.ghost.lastBfsTileKey = -1;
    state.ghost.cachedBfsStep = null;
    state.breathHold.active = false;
  }
  markHudDirty();
}

export function clearHeldInputs() {
  Object.keys(state.keys).forEach(k => { state.keys[k] = false; });
  state.padKeys.up = false;
  state.padKeys.down = false;
  state.padKeys.left = false;
  state.padKeys.right = false;
}

let cachedUnlockedEndings = null;

export function getUnlockedEndings() {
  if (cachedUnlockedEndings !== null) return cachedUnlockedEndings;
  try {
    const raw = safeGet("visitorEndings");
    cachedUnlockedEndings = raw ? JSON.parse(raw) : [];
  } catch (e) {
    cachedUnlockedEndings = [];
  }
  return cachedUnlockedEndings;
}

export function recordEndingUnlock(type) {
  const list = [...getUnlockedEndings()];
  if (!list.includes(type)) {
    list.push(type);
    cachedUnlockedEndings = list;
    safeSet("visitorEndings", JSON.stringify(list));
    markHudDirty();
  }
}

export function hasValidSaveData() {
  try {
    const raw = safeGet("visitorSave");
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
  if (state.mode === GAME_MODE.ENDED || state.mode === GAME_MODE.TITLE || state.mode === GAME_MODE.PROLOGUE) return;
  if (state.ghost.state !== GHOST_STATE.IDLE) return;
  const data = buildSavePayload();
  safeSet("visitorSave", JSON.stringify(data));
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

  state.sanity = typeof data.sanity === "number"
    ? Math.max(10, Math.min(SANITY_CONFIG.MAX, data.sanity))
    : SANITY_CONFIG.INITIAL;
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
  state.hallucination = { fakeClue: null, timer: 0 };
  state.flickerTimer = 0;
  state.screenShake = 0;
  state.notebookOpen = false;
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = state.currentRoom === "1304호 숨겨진 방" ? "out" : "on";
  state.endingType = null;
  state.tutorialStep = 0;
  setGameMode(GAME_MODE.PLAY);
  markHudDirty();
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

  state.sanity = SANITY_CONFIG.INITIAL;
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
  state.breathHold = {
    active: false,
    gauge: BREATH_CONFIG.BASE_GAUGE,
    timer: 0,
    duration: BREATH_CONFIG.BASE_DURATION
  };
  setGhostState(GHOST_STATE.IDLE);
  state.hallucination = { fakeClue: null, timer: 0 };
  state.endingType = null;
  state.tutorialStep = 0;
  state.screenShake = 0;
  setGameMode(GAME_MODE.PLAY);
  markHudDirty();
}
