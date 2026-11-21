/* =========================================================================
   2. 레트로 Web Audio 사운드 & 오컬트 앰비언트 BGM 모듈 (v1.5.0)
   ========================================================================= */
import { ROOMS } from "./data.js";
import { state, GAME_MODE, GHOST_STATE } from "./state.js";

let soundEnabled = true;
let audioCtx = null;
let bgmTimer = null;
let bgmStep = 0;

export function isSoundEnabled() {
  return soundEnabled;
}

export function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  startAmbientBgm();
}

function startAmbientBgm() {
  if (bgmTimer) return;
  bgmTimer = setInterval(() => {
    if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return;
    if (state.mode === GAME_MODE.TITLE || state.mode === GAME_MODE.ENDED) return;
    try {
      const roomInfo = ROOMS[state.currentRoom];
      const isCursed = roomInfo?.theme === "cursed";
      const tense = state.ghost.state === GHOST_STATE.CHASE || state.ghost.state === GHOST_STATE.WARNING;
      const notes = tense
        ? [110, 116.54, 103.83, 123.47]
        : (isCursed ? [73.42, 77.78, 69.30, 82.41] : [65.41, 73.42, 61.74, 65.41]);
      const freq = notes[bgmStep % notes.length];
      bgmStep++;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = tense ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      const peakVol = tense ? 0.024 : 0.016;
      gain.gain.setValueAtTime(0.0008, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(peakVol, audioCtx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0008, audioCtx.currentTime + 2.1);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 2.15);
    } catch (e) {}
  }, 2200);
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  if (soundEnabled) initAudio();
  return soundEnabled;
}

export function playTone(freq, type, duration, vol = 0.08, slideTo = null) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

export function playSfx(kind) {
  if (!soundEnabled) return;
  if (kind === "step") playTone(115, "triangle", 0.05, 0.032, 72);
  else if (kind === "bump") playTone(82, "square", 0.09, 0.04, 52);
  else if (kind === "door") playTone(165, "sawtooth", 0.22, 0.07, 65);
  else if (kind === "switch") playTone(680, "square", 0.05, 0.04, 420);
  else if (kind === "flicker") {
    playTone(120, "sawtooth", 0.08, 0.06, 58);
    setTimeout(() => playTone(920, "square", 0.04, 0.035, 310), 65);
  } else if (kind === "light_on") {
    playTone(340, "sine", 0.09, 0.05, 520);
  } else if (kind === "item") {
    playTone(587, "sine", 0.1, 0.08);
    setTimeout(() => playTone(880, "sine", 0.16, 0.08), 90);
  } else if (kind === "clue") {
    playTone(523, "sine", 0.12, 0.08);
    setTimeout(() => playTone(659, "sine", 0.18, 0.08), 110);
  } else if (kind === "combo") {
    playTone(440, "triangle", 0.12, 0.09);
    setTimeout(() => playTone(554, "triangle", 0.12, 0.09), 100);
    setTimeout(() => playTone(659, "triangle", 0.25, 0.1), 200);
  } else if (kind === "flashback") {
    playTone(330, "sine", 0.22, 0.09, 440);
    setTimeout(() => playTone(494, "sine", 0.25, 0.09, 659), 180);
    setTimeout(() => playTone(880, "triangle", 0.45, 0.08), 380);
  } else if (kind === "ghost") {
    playTone(92, "sawtooth", 0.65, 0.14, 40);
    setTimeout(() => playTone(760, "sine", 0.45, 0.06, 200), 120);
  } else if (kind === "heartbeat") {
    playTone(62, "sine", 0.14, 0.13, 38);
    setTimeout(() => playTone(55, "sine", 0.16, 0.1, 35), 180);
  } else if (kind === "hide") {
    playTone(220, "sine", 0.14, 0.06, 130);
  } else if (kind === "breath") {
    playTone(420, "sine", 0.06, 0.05, 520);
  }
}
