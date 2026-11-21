/* =========================================================================
   2. 레트로 Web Audio 사운드 & 오컬트 앰비언트 BGM 모듈 (v1.6.0)
   ========================================================================= */
import { ROOMS } from "./data.js";
import { state, GAME_MODE, GHOST_STATE } from "./state.js";

let soundEnabled = true;
let audioCtx = null;
let bgmTimer = null;
let bgmStep = 0;
let cachedNoiseBuffer = null;

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

function getNoiseBuffer() {
  if (!audioCtx) return null;
  if (cachedNoiseBuffer) return cachedNoiseBuffer;
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * 1.0;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

function playNoiseBurst(duration, filterFreq, filterType = "bandpass", vol = 0.06, q = 2.0) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const buf = getNoiseBuffer();
    if (!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, audioCtx.currentTime);
    filter.Q.setValueAtTime(q, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    src.stop(audioCtx.currentTime + duration);
  } catch (e) {}
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

export function playVoiceBlip(speaker = "") {
  if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return;
  const name = speaker || "";
  if (name.includes("윤서")) {
    playTone(540 + (Math.random() - 0.5) * 30, "sine", 0.032, 0.016, 500);
  } else if (name.includes("박만식")) {
    playTone(190 + (Math.random() - 0.5) * 18, "triangle", 0.036, 0.022, 165);
  } else if (name.includes("한미정")) {
    playTone(430 + (Math.random() - 0.5) * 24, "sine", 0.032, 0.018, 410);
  } else if (name.includes("강현우")) {
    playTone(295 + (Math.random() - 0.5) * 20, "triangle", 0.032, 0.018, 275);
  } else if (name.includes("방문자") || name.includes("BAD END") || name.includes("GAME OVER")) {
    playTone(125 + (Math.random() - 0.5) * 25, "sawtooth", 0.045, 0.02, 85);
  } else {
    playTone(470, "sine", 0.024, 0.012, 450);
  }
}

export function playSfx(kind) {
  if (!soundEnabled) return;
  if (kind === "step") playTone(115, "triangle", 0.05, 0.032, 72);
  else if (kind === "bump") playTone(82, "square", 0.09, 0.04, 52);
  else if (kind === "door") playTone(165, "sawtooth", 0.22, 0.07, 65);
  else if (kind === "switch") playTone(680, "square", 0.05, 0.04, 420);
  else if (kind === "knock") {
    playTone(138, "triangle", 0.14, 0.14, 46);
    playNoiseBurst(0.06, 380, "bandpass", 0.07, 1.8);
  } else if (kind === "knock3") {
    playSfx("knock");
    setTimeout(() => playSfx("knock"), 340);
    setTimeout(() => playSfx("knock"), 680);
  } else if (kind === "clock_tick") {
    playTone(1280, "square", 0.018, 0.022, 880);
  } else if (kind === "clock_stop") {
    playTone(220, "sine", 0.45, 0.07, 110);
    setTimeout(() => playTone(146.83, "triangle", 0.55, 0.06, 73.42), 90);
  } else if (kind === "flicker") {
    playTone(120, "sawtooth", 0.08, 0.06, 58);
    playNoiseBurst(0.07, 1600, "bandpass", 0.04, 2.4);
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
    playNoiseBurst(0.35, 420, "lowpass", 0.08, 1.2);
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
