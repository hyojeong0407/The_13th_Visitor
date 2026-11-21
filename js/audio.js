/* =========================================================================
   2. 레트로 Web Audio 사운드 & 프로시저럴 노이즈 합성 모듈 (v1.7.0)
   - 입체 3연타 노크음, 60/120Hz 형광등 교류 험 & 스파크 노이즈, 화자별 보이스 블립 고도화
   ========================================================================= */
import { ROOMS } from "./data.js";
import { state, GAME_MODE, GHOST_STATE } from "./state.js";

let soundEnabled = true;
let audioCtx = null;
let bgmTimer = null;
let bgmStep = 0;
let cachedNoiseBuffer = null;

// 형광등 험 노이즈 실시간 노드 상태
let humNodes = null;
let humCrackTimer = 0;

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
  const length = sampleRate * 1.5;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
}

function playNoiseBurst(duration, filterFreq, filterType = "bandpass", vol = 0.06, q = 2.0, delay = 0) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const buf = getNoiseBuffer();
    if (!buf) return;
    const now = audioCtx.currentTime + delay;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0005, vol), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + duration + 0.01);
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

/* -------------------------------------------------------------------------
   형광등 60Hz/120Hz 교류 전원 험(Hum) + 고주파 스파크 크래클 노이즈 엔진
   ------------------------------------------------------------------------- */
function startFluorescentHum() {
  if (humNodes || !soundEnabled || !audioCtx || audioCtx.state !== "running") return;
  try {
    const now = audioCtx.currentTime;
    const osc60 = audioCtx.createOscillator();
    const osc120 = audioCtx.createOscillator();
    osc60.type = "sawtooth";
    osc120.type = "triangle";
    osc60.frequency.setValueAtTime(60, now);
    osc120.frequency.setValueAtTime(120, now);

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(180, now);
    bandpass.Q.setValueAtTime(1.4, now);

    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0005, now);
    masterGain.gain.linearRampToValueAtTime(0.026, now + 0.14);

    osc60.connect(bandpass);
    osc120.connect(bandpass);
    bandpass.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    osc60.start(now);
    osc120.start(now);
    humNodes = { osc60, osc120, bandpass, masterGain };
  } catch (e) {
    humNodes = null;
  }
}

export function stopFluorescentHum() {
  if (!humNodes) return;
  const nodes = humNodes;
  humNodes = null;
  try {
    if (audioCtx) {
      const now = audioCtx.currentTime;
      nodes.masterGain.gain.setValueAtTime(Math.max(0.0005, nodes.masterGain.gain.value), now);
      nodes.masterGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);
      nodes.osc60.stop(now + 0.09);
      nodes.osc120.stop(now + 0.09);
    } else {
      nodes.osc60.stop();
      nodes.osc120.stop();
    }
  } catch (e) {}
}

export function updateFluorescentHum(dt, isFlickering, isLightOn) {
  if (!soundEnabled || !isFlickering || state.mode === GAME_MODE.TITLE || state.mode === GAME_MODE.ENDED) {
    stopFluorescentHum();
    return;
  }
  if (!audioCtx || audioCtx.state !== "running") return;
  if (!humNodes) startFluorescentHum();
  if (!humNodes) return;

  try {
    const now = audioCtx.currentTime;
    const targetVol = isLightOn ? 0.032 : 0.009;
    humNodes.masterGain.gain.setTargetAtTime(targetVol, now, 0.025);
    humNodes.osc120.frequency.setTargetAtTime(isLightOn ? 120 : 114, now, 0.03);

    humCrackTimer -= dt;
    if (humCrackTimer <= 0) {
      humCrackTimer = 0.14 + Math.random() * 0.26;
      playNoiseBurst(0.035, 2200 + Math.random() * 1400, "bandpass", 0.022, 3.2);
    }
  } catch (e) {}
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  if (soundEnabled) initAudio();
  else stopFluorescentHum();
  return soundEnabled;
}

export function playTone(freq, type, duration, vol = 0.08, slideTo = null, delay = 0) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(Math.max(0.0005, vol), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  } catch (e) {}
}

/* -------------------------------------------------------------------------
   화자별 보이스 블립 (자음 노이즈 어택 + 캐릭터 고유 포먼트 + 문장부호 억양)
   ------------------------------------------------------------------------- */
export function playVoiceBlip(speaker = "", lastChar = "") {
  if (!soundEnabled || !audioCtx || audioCtx.state !== "running") return;
  const name = speaker || "";
  const isQuestion = lastChar === "?";
  const isExclaim = lastChar === "!";
  const isPeriod = lastChar === "." || lastChar === "…";

  let baseFreq = 460;
  let wave = "sine";
  let dur = 0.03;
  let vol = 0.014;
  let noiseFreq = 1400;

  if (name.includes("윤서")) {
    baseFreq = 555 + (Math.random() - 0.5) * 26;
    wave = "sine";
    dur = 0.032;
    vol = 0.016;
    noiseFreq = 2100;
  } else if (name.includes("박만식")) {
    baseFreq = 185 + (Math.random() - 0.5) * 16;
    wave = "triangle";
    dur = 0.038;
    vol = 0.022;
    noiseFreq = 820;
  } else if (name.includes("한미정")) {
    baseFreq = 435 + (Math.random() - 0.5) * 22;
    wave = "sine";
    dur = 0.032;
    vol = 0.018;
    noiseFreq = 1750;
  } else if (name.includes("강현우")) {
    baseFreq = 292 + (Math.random() - 0.5) * 18;
    wave = "triangle";
    dur = 0.033;
    vol = 0.019;
    noiseFreq = 1250;
  } else if (name.includes("방문자") || name.includes("BAD END") || name.includes("GAME OVER")) {
    baseFreq = 122 + (Math.random() - 0.5) * 24;
    wave = "sawtooth";
    dur = 0.048;
    vol = 0.021;
    noiseFreq = 620;
  }

  let endFreq = baseFreq * 0.94;
  if (isQuestion) {
    endFreq = baseFreq * 1.24;
    dur += 0.012;
  } else if (isExclaim) {
    baseFreq *= 1.08;
    endFreq = baseFreq * 1.12;
    vol *= 1.15;
  } else if (isPeriod) {
    endFreq = baseFreq * 0.84;
  }

  playTone(baseFreq, wave, dur, vol, endFreq);
  playNoiseBurst(0.014, noiseFreq, "bandpass", vol * 0.45, 2.6);
}

/* -------------------------------------------------------------------------
   입체 문 노크음 합성 (저역 문판 공명 + 목재/철문 타격 노이즈 + 공간 잔향)
   ------------------------------------------------------------------------- */
function playLayeredKnock(accent = 1.0, delay = 0) {
  const pitchJitter = 0.96 + Math.random() * 0.08;
  // 1) 문판 멤브레인 저역 충격
  playTone(144 * pitchJitter, "triangle", 0.14, 0.14 * accent, 44, delay);
  // 2) 너클 타격 어택 노이즈
  playNoiseBurst(0.045, 520 * pitchJitter, "bandpass", 0.085 * accent, 2.2, delay);
  // 3) 복도 문틀 공진 울림
  playNoiseBurst(0.11, 210 * pitchJitter, "lowpass", 0.065 * accent, 1.4, delay + 0.018);
}

export function playSfx(kind) {
  if (!soundEnabled) return;
  if (kind === "step") {
    playTone(115, "triangle", 0.05, 0.032, 72);
    playNoiseBurst(0.025, 420, "lowpass", 0.015, 1.2);
  } else if (kind === "bump") {
    playTone(82, "square", 0.09, 0.04, 52);
  } else if (kind === "door") {
    playTone(165, "sawtooth", 0.22, 0.07, 65);
    playNoiseBurst(0.16, 320, "bandpass", 0.04, 1.6);
  } else if (kind === "switch") {
    playTone(680, "square", 0.05, 0.04, 420);
  } else if (kind === "knock") {
    playLayeredKnock(1.0, 0);
  } else if (kind === "knock3") {
    playLayeredKnock(0.92, 0);
    playLayeredKnock(1.0, 0.34);
    playLayeredKnock(1.12, 0.68);
  } else if (kind === "clock_tick") {
    playTone(1280, "square", 0.018, 0.022, 880);
  } else if (kind === "clock_stop") {
    playTone(220, "sine", 0.45, 0.07, 110);
    playTone(146.83, "triangle", 0.55, 0.06, 73.42, 0.09);
  } else if (kind === "flicker") {
    playTone(120, "sawtooth", 0.08, 0.06, 58);
    playNoiseBurst(0.07, 1600, "bandpass", 0.045, 2.4);
    playTone(920, "square", 0.04, 0.035, 310, 0.065);
  } else if (kind === "light_on") {
    playTone(340, "sine", 0.09, 0.05, 520);
  } else if (kind === "item") {
    playTone(587, "sine", 0.1, 0.08);
    playTone(880, "sine", 0.16, 0.08, null, 0.09);
  } else if (kind === "clue") {
    playTone(523, "sine", 0.12, 0.08);
    playTone(659, "sine", 0.18, 0.08, null, 0.11);
  } else if (kind === "combo") {
    playTone(440, "triangle", 0.12, 0.09);
    playTone(554, "triangle", 0.12, 0.09, null, 0.1);
    playTone(659, "triangle", 0.25, 0.1, null, 0.2);
  } else if (kind === "flashback") {
    playTone(330, "sine", 0.22, 0.09, 440);
    playTone(494, "sine", 0.25, 0.09, 659, 0.18);
    playTone(880, "triangle", 0.45, 0.08, null, 0.38);
  } else if (kind === "ghost") {
    playTone(92, "sawtooth", 0.65, 0.14, 40);
    playNoiseBurst(0.35, 420, "lowpass", 0.08, 1.2);
    playTone(760, "sine", 0.45, 0.06, 200, 0.12);
  } else if (kind === "heartbeat") {
    playTone(62, "sine", 0.14, 0.13, 38);
    playTone(55, "sine", 0.16, 0.1, 35, 0.18);
  } else if (kind === "hide") {
    playTone(220, "sine", 0.14, 0.06, 130);
  } else if (kind === "breath") {
    playTone(420, "sine", 0.06, 0.05, 520);
    playNoiseBurst(0.05, 950, "bandpass", 0.025, 1.8);
  }
}
