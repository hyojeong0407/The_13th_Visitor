/* =========================================================================
   《13번째 방문자》 v1.3.0 - 한국형 16비트 픽셀 공포 추리 RPG
   (반전 비공개 서사 · 질문형 추리 게이트 · BFS 추격 AI · 기억 회상 컷신 · IME 대응)
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. 레트로 Web Audio 사운드 & 오컬트 앰비언트 BGM 시스템
   ------------------------------------------------------------------------- */
const GAME_VERSION = (typeof window !== "undefined" && window.APP_VERSION) ? window.APP_VERSION : "1.3.0";
let soundEnabled = true;
let audioCtx = null;
let bgmTimer = null;
let bgmStep = 0;

function initAudio() {
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
    if (titleActive || gameEnded) return;
    try {
      const is13F = currentRoom.includes("13");
      const tense = ghost.active || lightState === "flicker";
      const notes = tense
        ? [110, 116.54, 103.83, 123.47]
        : (is13F ? [73.42, 77.78, 69.30, 82.41] : [65.41, 73.42, 61.74, 65.41]);
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

function toggleSound() {
  soundEnabled = !soundEnabled;
  if (soundEnabled) initAudio();
  const btn = document.getElementById("btn-sound");
  if (btn) btn.textContent = "사운드: " + (soundEnabled ? "ON" : "OFF");
}

function playTone(freq, type, duration, vol = 0.08, slideTo = null) {
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

function playSfx(kind) {
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
  }
}

/* -------------------------------------------------------------------------
   2. 프롤로그(반전 비공개), 기억 회상 컷신 & 상황 트리거 튜토리얼 데이터
   ------------------------------------------------------------------------- */
const PROLOGUE_SCENES = [
  {
    chapter: "PROLOGUE 01 · 1985년 10월 13일 23:47",
    title: "도면에 존재하지 않는 층",
    art: "apt_night",
    text: "1985년 10월 13일 밤 11시 47분.\n서울 외곽의 신축 단지 [[gold:은하아파트]]에서 일가족 네 명이 흔적도 없이 사라졌다.\n준공 도면상 건물은 [[gold:12층]]까지만 존재했지만, 사건 현장은 도면 밖의 [[red:13층 1304호]]였다."
  },
  {
    chapter: "PROLOGUE 02 · 봉인된 기록",
    title: "기록에서 지워진 생존자",
    art: "corridor_13",
    text: "그날 밤 현장에 출동했던 선임 순경은 실종되었고, 비상구 앞에 쓰러져 있던 열다섯 살 소년만이 홀로 구조되었다.\n극심한 충격으로 그날의 기억을 잃은 소년의 이름은 수사 기록에서 지워진 채 사건은 미제로 봉인되었다."
  },
  {
    chapter: "PROLOGUE 03 · 1998년 10월 13일 23:47",
    title: "열세 번째 노크 소리",
    art: "knock_door",
    text: "참극으로부터 정확히 13년이 흐른 [[gold:1998년 10월 13일]].\n철거를 앞둔 은하아파트 1304호에서 매일 밤 [[gold:11시 47분]]마다 정체불명의 노크 소리와 전기·수도 사용량이 기록된다는 신고가 접수된다."
  },
  {
    chapter: "PROLOGUE 04 · 수사 개시",
    title: "은하아파트 1층 로비",
    art: "detective_arrive",
    text: "설명할 수 없는 기시감에 이끌려 홀로 아파트를 찾은 신입 형사 [[blue:강현우]].\n현관문이 닫히는 소리와 함께 로비의 시계가 [[gold:23:47]]에서 멈춰 섰다.\n이제 단서를 모으고 조합해, [[red:13번째 방문자]]의 진실을 밝혀야 한다."
  }
];

const FLASHBACK_SCENES = {
  past: {
    chapter: "MEMORY FLASHBACK · 1985.10.13 23:47",
    title: "봉인된 기억의 복원 — 비상구 앞의 소년",
    art: "memory_rescue",
    text: "번진 잉크 너머의 이름 [[blue:강현우]]와 방문자 명부의 마지막 줄이 하나로 겹쳐진다.\n1985년 그날 밤, 선임 강 순경의 손을 잡고 13층으로 올라갔던 15세 소년은 바로 [[blue:나 자신]]이었다.\n광기에 잠식된 아버지로부터 [[blue:윤서]]를 구하려다 비상구 앞에 쓰러졌던 그날의 기억이 되살아난다."
  },
  yoonseo: {
    chapter: "MEMORY FLASHBACK · 1985.10.13 23:45",
    title: "1304호의 마지막 밤 — 소녀 윤서",
    art: "memory_yoonseo",
    text: "사진 창문에 비친 기이한 그림자와 진료 기록의 조각이 맞물린다.\n[[blue:윤서]]는 사람들을 해치는 악령이 아니라, 문밖을 두드리는 광기 어린 [[red:13번째 방문자]]를 피해 벽장 뒤에서 구조를 기다리다 멈춘 시간에 갇힌 소녀였다."
  }
};

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "튜토리얼 1/4 · 이동 및 전력 질주",
    text: "[[blue:방향키(↑↓←→)]] 또는 [[blue:WASD]]로 이동하고, [[blue:Shift]] 키를 누른 채 이동하면 전력 질주합니다.\n한글 입력 상태에서도 동일하게 작동합니다."
  },
  {
    step: 2,
    title: "튜토리얼 2/4 · 주변 단서 및 인물 조사",
    text: "반짝이는 노란색 [[gold:[!]]] 표식이나 흰색 소품, 주민 앞에서 [[blue:E]] 또는 [[blue:Space]] 키를 누르면 조사 및 대화가 진행됩니다."
  },
  {
    step: 3,
    title: "튜토리얼 3/4 · 수사 수첩 추리 조합",
    text: "단서가 2개 이상 모였습니다. 우측 [[gold:수사 수첩]]에서 각 단서의 [[mint:추리 질문]]을 읽고 서로 연결되는 단서 2개를 선택한 뒤 [[blue:[단서 조합 (C)]]]을 누르세요.\n(단, 억지 조합 시 정신력이 5 감소합니다.)"
  },
  {
    step: 4,
    title: "튜토리얼 4/4 · 형광등 점멸과 은신 · 구역 이탈",
    text: "천장 형광등이 [[red:불규칙하게 깜빡이면(10초 유예)]] 추격자가 나타납니다.\n시야 밖에서 은신처에 [[blue:[H]]]로 숨거나, [[red:문을 두 번 이상 통과해 다른 구역으로 따돌리세요!]]"
  }
];

/* -------------------------------------------------------------------------
   3. 게임 데이터 (질문형 추리 단서 12종, 증거 조합 7종, 아이템 5종, 소품 8종)
   ------------------------------------------------------------------------- */
const CLUES = [
  {
    id: "newspaper",
    name: "1998년 10월자 낡은 신문",
    room: "1층 복도",
    x: 3, y: 3,
    description: "우편함 옆에 구겨진 조간신문.\n'IMF 한파 속 재개발 표류... 은하아파트 철거 또 연기. 1985년 준공 직후 발생한 1304호 일가족 실종 미제 사건 이후 괴담이 끊이지 않아 입주민이 모두 떠나며 흉가로 방치돼 왔다.'",
    importance: "1985년 1304호 실종 사건 이후 괴담 때문에 주민들이 떠나고 재개발마저 표류 중이다.",
    comboHint: "13년째 비어 있다는 1304호에 지금도 누군가 살고 있다는 증거가 있을까?",
    truthIds: ["combo_ghost_house"]
  },
  {
    id: "blueprint",
    name: "1985년 준공 도면",
    room: "경비실",
    x: 11, y: 5,
    description: "은하아파트의 공식 건축 도면.\n지하 1층부터 지상 12층까지만 설계되어 있다. 13층은 도면 어디에도 존재하지 않는다.",
    importance: "은하아파트에는 원래 13층이 없다. 13층은 참극의 원념이 만들어낸 비현실적 공간이다.",
    comboHint: "도면에 없는 13층을 봉쇄했거나 그곳에 갇혔던 흔적이 남아 있을까?",
    truthIds: ["combo_space", "combo_coverup"]
  },
  {
    id: "guard_log",
    name: "1985년 경비 근무일지",
    room: "경비실",
    x: 3, y: 5,
    description: "박만식의 필체로 적힌 낡은 근무일지.\n'1985.10.13 23:47 - 13층 비상 방화문 시건 조치. 상부 지시로 13층 출입 기록 전체 파기.'",
    importance: "1985년 10월 13일 밤, 경비원 박만식이 13층 방화문을 밖에서 잠그고 출입 기록을 파기했다.",
    comboHint: "경비원이 숨기려 했던 13층의 존재를 공식 건축 기록과 대조해 볼 수 있을까?",
    truthIds: ["combo_coverup"]
  },
  {
    id: "car_memo",
    name: "순찰차 내 수사 메모",
    room: "지하 주차장",
    x: 5, y: 6,
    description: "1985년 현장 지원 순경이 남긴 기록 수첩.\n'1985.10.13 1304호 일가족 실종. 선임 강 순경 실종, 비상구 앞에서 구조된 순경의 아들 □□□(당시 15세)는 기억 상실 상태로 이송됨.'",
    importance: "1985년 실종된 강 순경의 아들이 바로 강현우 자신이며, 기억을 잃은 채 13번째 방문자로 돌아왔다.",
    comboHint: "13년 전 현장에서 살아남은 소년의 이름이 적힌 또 다른 기록이 있을까?",
    truthIds: ["combo_past"]
  },
  {
    id: "tally",
    name: "벽면의 긁힌 자국",
    room: "13층 복도",
    x: 9, y: 2,
    description: "콘크리트 벽을 손톱으로 긁어 남긴 열두 줄의 표시.\n그 아래 피로 쓴 듯한 글씨가 희미하다. '윤서를 지켜야 해. 문을 열지 마.'",
    importance: "누군가 존재하지 않는 13층 복도에서 필사적으로 버티며 경고를 남겼다.",
    comboHint: "건물 설계 자체와 모순되는 이 13층의 존재를 입증할 공식 자료가 있을까?",
    truthIds: ["combo_space"]
  },
  {
    id: "photo",
    name: "가족사진",
    room: "1304호 거실",
    x: 13, y: 2,
    description: "사진 속에는 네 명의 가족이 서 있다.\n그런데 사진 뒤편 어두운 베란다 창문에 낯선 남자의 얼굴이 비쳐 있다.",
    importance: "실종 당일 촬영된 사진에 가족을 노리던 불청객의 형상이 찍혀 있다.",
    comboHint: "사진 창문에 비친 불길한 그림자와 1304호 가족의 진료 기록 사이에 연관성이 있을까?",
    truthIds: ["combo_yoonseo"]
  },
  {
    id: "letter",
    name: "찢어진 편지",
    room: "1304호 거실",
    x: 4, y: 6,
    description: "'그 사람은 우리가 알던 모습이 아니야. 13층에서 들리는 노크 소리를 더는 무시할 수 없어. 오늘 밤 아이를 벽장 뒤에 숨겨야 해.'",
    importance: "어머니가 10월 13일 밤 아이를 보호하기 위해 벽장 뒤 밀실에 숨기려 했다.",
    comboHint: "어머니가 아이를 숨기려 했던 '벽장 뒤'에 대해 아이 본인은 무엇을 기록했을까?",
    truthIds: ["combo_secret"]
  },
  {
    id: "bill",
    name: "1998년 관리비 고지서",
    room: "1304호 거실",
    x: 11, y: 4,
    description: "1304호 앞으로 발행된 1998년 10월분 관리비 명세서.\n13년째 거주자가 없는데도 매일 밤 11시 47분경 급격한 전기·수도 사용량이 기록되어 있다.",
    importance: "1304호는 1985년 밤 11시 47분의 시간이 멈춘 채 13년째 그날의 흔적을 반복 재생하고 있다.",
    comboHint: "13년간 방치된 건물의 재개발 표류 기사와 이 고지서를 함께 보면 무엇이 보일까?",
    truthIds: ["combo_ghost_house"]
  },
  {
    id: "diary",
    name: "아이의 일기",
    room: "1304호 아이 방",
    x: 7, y: 3,
    description: "10월 13일.\n오늘도 13번째 사람이 문을 두드렸다.\n엄마는 그 사람이 아빠라고 말했다.\n하지만 문틈으로 본 눈은 내가 알던 아빠가 아니었다.",
    importance: "광기에 잠식된 아버지가 '13번째 방문자'가 되어 가족의 문을 두드리고 있었다.",
    comboHint: "아이가 두려워하던 '13번째 사람'을 피해 어머니가 마련한 피난처는 어디였을까?",
    truthIds: ["combo_secret"]
  },
  {
    id: "medical",
    name: "병원 기록",
    room: "1304호 안방",
    x: 11, y: 5,
    description: "환자명: 윤서.\n진단: 심한 해리 증상 및 반복적인 환청.\n보호자 서명란에는 실종된 아버지의 이름이 적혀 있다.",
    importance: "윤서는 악령이 아니라 비극 속에서 홀로 살아남아 구조를 기다리던 소녀다.",
    comboHint: "환자 윤서의 진료 기록과 가족의 마지막 모습이 담긴 사진을 대조해 볼 수 있을까?",
    truthIds: ["combo_yoonseo"]
  },
  {
    id: "recording",
    name: "녹음기",
    room: "1304호 숨겨진 방",
    x: 6, y: 4,
    description: "녹음 재생...\n'문을 열지 마. 내가 돌아오면 절대 문을 열면 안 돼. 그건 내가 아니야.'\n그 뒤로 세 번의 무거운 노크 소리가 들린다.",
    importance: "환청과 노크 소리에 속아 문을 열면 새로운 13번째 방문자가 되어 영원히 갇힌다.",
    comboHint: "녹음이 경고하는 '문을 열면 안 되는 이유'와 방문자 기록의 마지막 줄은 어떻게 이어질까?",
    truthIds: ["combo_trap"]
  },
  {
    id: "ledger",
    name: "방문자 명부",
    room: "1304호 숨겨진 방",
    x: 11, y: 6,
    description: "은하아파트 방문자 기록.\n1998년 10월 13일.\n방문자 1번부터 12번까지 이름이 지워져 있고, 마지막 13번째 줄에는 '강현우'라고 적혀 있다.",
    importance: "강현우 자신의 이름이 13번째 방문자로 기록되어 있으며, 13년 전 생존 소년과 연결된다.",
    comboHint: "마지막 13번째 칸에 적힌 이름의 과거 행적이나, 문밖 노크의 경고를 담은 기록이 있을까?",
    truthIds: ["combo_past", "combo_trap"]
  }
];

const COMBINATIONS = [
  {
    id: "combo_space",
    pair: ["blueprint", "tally"],
    title: "[진실 1] 도면에 없는 13층의 비밀",
    summary: "은하아파트는 12층까지만 존재한다. 13층은 1985년 10월 13일의 참극과 원념이 응결되어 만들어진 비현실적 이계(異界)다.",
    onUnlock: () => {
      if (!flags.door1304Unlocked) {
        flags.door1304Unlocked = true;
        addLog("13층의 구조를 파악해 1304호 현관문을 열 수 있게 되었다.");
      }
    }
  },
  {
    id: "combo_coverup",
    pair: ["blueprint", "guard_log"],
    title: "[진실 2] 은폐된 방화문 봉쇄",
    summary: "1985년 그날 밤, 경비원 박만식은 참극을 목격하고도 13층 방화문을 밖에서 잠근 채 출입 기록을 파기했다.",
    onUnlock: () => {
      if (!flags.door1304Unlocked) {
        flags.door1304Unlocked = true;
        addLog("방화문 봉쇄 경위를 밝혀내 1304호 진입 단서를 확보했다.");
      }
    }
  },
  {
    id: "combo_secret",
    pair: ["letter", "diary"],
    title: "[진실 3] 아이 방 벽장 뒤 밀실",
    summary: "13번째 방문자의 위협을 느낀 어머니는 윤서를 보호하기 위해 아이 방 벽장 뒤에 비밀 방을 만들어 숨겼다.",
    onUnlock: () => {
      if (!flags.secretOpen) {
        flags.secretOpen = true;
        addLog("증거 조합으로 아이 방 벽장 뒤 비밀 통로를 여는 방법을 알아냈다!");
      }
    }
  },
  {
    id: "combo_yoonseo",
    pair: ["photo", "medical"],
    title: "[진실 4] 소녀 윤서의 정체",
    summary: "윤서는 악령이 아니라 13년 전 아버지의 광기 속에서 홀로 살아남아 구조를 기다리다 13층의 시간에 갇혀버린 소녀다.",
    onUnlock: () => {
      if (!flags.flashbackYoonseoSeen) {
        flags.flashbackYoonseoSeen = true;
        triggerMemoryFlashback("yoonseo");
      }
    }
  },
  {
    id: "combo_past",
    pair: ["car_memo", "ledger"],
    title: "[진실 5] 강현우의 잃어버린 기억",
    summary: "13년 전 사건 현장에서 구조되었던 강 순경의 15세 아들이 바로 강현우 자신이다. 트라우마로 기억을 잃은 채 윤서를 구하기 위해 되돌아온 것이다.",
    onUnlock: () => {
      if (!flags.flashbackPastSeen) {
        flags.flashbackPastSeen = true;
        triggerMemoryFlashback("past");
      }
    }
  },
  {
    id: "combo_trap",
    pair: ["recording", "ledger"],
    title: "[진실 6] 13번째 방문자의 법칙",
    summary: "진실을 깨닫지 못한 채 거울과 문의 환청에 속아 문을 열면, 그 자가 새로운 13번째 방문자가 되어 영원히 13층에 갇힌다."
  },
  {
    id: "combo_ghost_house",
    pair: ["bill", "newspaper"],
    title: "[진실 7] 1304호의 잔류 시간",
    summary: "1304호는 1985년 10월 13일 밤 11시 47분의 시간 속에 멈춘 채, 당시의 생활 흔적과 원념을 13년째 반복 재생하고 있다."
  }
];

/* 필드에서 획득 가능한 소비 아이템 (신경안정제 3개로 긴장감 유지) */
const FIELD_ITEMS = [
  {
    id: "sed_1f",
    type: "sedative",
    name: "구급함 신경안정제",
    room: "1층 복도",
    x: 16, y: 5,
    desc: "안내판 옆 비상 구급상자에서 찾은 처방 안정제. 극심한 공포를 진정시켜 정신력을 30 회복한다."
  },
  {
    id: "sed_b1",
    type: "sedative",
    name: "순찰차 비상 안정제",
    room: "지하 주차장",
    x: 3, y: 7,
    desc: "방치된 순찰 차량 구급 키트에서 발견한 안정제. 복용 시 정신력을 30 회복한다."
  },
  {
    id: "sed_master",
    type: "sedative",
    name: "화장대 신경안정제",
    room: "1304호 안방",
    x: 10, y: 3,
    desc: "화장대 서랍에 보관되어 있던 약병. 복용 시 정신력을 30 회복한다."
  }
];

/* 1998년 한국 아파트 환경 소품 (8종 모두 조사 시 추가 통찰 보상) */
const PROPS = [
  {
    id: "clock_1f",
    name: "로비 대형 벽시계",
    room: "1층 복도",
    x: 13, y: 2,
    speaker: "강현우",
    speakerClass: "c-hero",
    text: "초침이 11시 47분에서 완전히 멈춰 서 있다. 유리 안쪽에는 습기가 차 1985년 10월 13일이라는 날짜 표식이 희미하게 보인다."
  },
  {
    id: "intercom_guard",
    name: "경비실 인터폰",
    room: "경비실",
    x: 6, y: 2,
    speaker: "SYSTEM",
    speakerClass: "c-system",
    text: "인터폰의 [1304호] 호출 램프가 불규칙하게 점멸한다. 수화기를 들자 치지직거리는 잡음 너머로 아이의 작은 숨소리가 들린다.",
    sanityDelta: -3,
    sanityReason: "인터폰 너머의 기이한 숨소리"
  },
  {
    id: "warning_b1",
    name: "지하 계단 경고문",
    room: "지하 주차장",
    x: 12, y: 2,
    speaker: "SYSTEM",
    speakerClass: "c-system",
    text: "'관리사무소 공지: 12층 이상 비상계단 통행 금지. 야간 순찰자 외 엘리베이터 13층 버튼 조작을 엄금함.'"
  },
  {
    id: "notice_elev",
    name: "승강기 검사필증",
    room: "엘리베이터",
    x: 7, y: 2,
    speaker: "강현우",
    speakerClass: "c-hero",
    text: "운행 층수: B1 ~ 12F. 정원 15명. 하지만 조작반 최하단에는 규격에 맞지 않는 붉은색 [13] 버튼이 억지로 끼워져 있다."
  },
  {
    id: "door_1303",
    name: "용접된 1303호 철문",
    room: "13층 복도",
    x: 22, y: 2,
    speaker: "강현우",
    speakerClass: "c-hero",
    text: "1303호 현관문은 쇠사슬과 용접 자국으로 굳게 봉인되어 있다. 문틈에는 부적 조각이 검게 그을린 채 붙어 있다."
  },
  {
    id: "phone_living",
    name: "다이얼 유선전화기",
    room: "1304호 거실",
    x: 6, y: 3,
    speaker: "SYSTEM",
    speakerClass: "c-system",
    text: "전화선이 끊어진 지 오래인데도 수화기에서 뚜- 뚜- 하는 발신음이 울린다. 다이얼 옆 메모지에는 '112'가 급하게 적혀 있다."
  },
  {
    id: "calendar_master",
    name: "1985년 10월 달력",
    room: "1304호 안방",
    x: 4, y: 2,
    speaker: "강현우",
    speakerClass: "c-hero",
    text: "벽에 걸린 달력이 1985년 10월에서 멈춰 있다. 10월 13일 칸에는 붉은 색연필로 동그라미가 여러 겹 그려져 있다."
  },
  {
    id: "doll_child",
    name: "낡은 봉제 인형",
    room: "1304호 아이 방",
    x: 4, y: 4,
    speaker: "윤서",
    speakerClass: "c-ghost",
    text: "인형 옆에 놓인 쪽지에 비뚤비뚤한 글씨가 적혀 있다. '오빠, 벽장 뒤로 오면 안 돼요... 아빠가 문을 두드리고 있어요...'",
    sanityDelta: -4,
    sanityReason: "아이 방 인형에 남겨진 섬뜩한 메모"
  }
];

/* 구역별 가변 맵 크기 (cols, rows) & 은신처 배치 */
const ROOMS = {
  "1층 복도": {
    cols: 20, rows: 9,
    bg: "#1b1d29", floorA: "#272a38", floorB: "#222532", wall: "#4d4a5c",
    furniture: [
      { x: 2, y: 2, w: 3, h: 1, color: "#574b42", label: "우편함", style: "mailbox" },
      { x: 7, y: 2, w: 2, h: 1, color: "#444c5e", label: "현관 게시판", style: "board" },
      { x: 14, y: 6, w: 3, h: 1, color: "#3d4454", label: "안내판", style: "board" }
    ],
    hidingSpots: [],
    doors: [
      { x: 1, y: 4, to: "경비실", tx: 13, ty: 4, label: "경비실" },
      { x: 10, y: 7, to: "지하 주차장", tx: 10, ty: 2, label: "지하 주차장" },
      { x: 18, y: 3, to: "엘리베이터", tx: 3, ty: 4, label: "엘리베이터" }
    ]
  },
  "경비실": {
    cols: 16, rows: 9,
    bg: "#1d1a24", floorA: "#2d2836", floorB: "#27232f", wall: "#594e63",
    furniture: [
      { x: 2, y: 2, w: 3, h: 2, color: "#5c493e", label: "경비 책상", style: "desk" },
      { x: 7, y: 2, w: 2, h: 1, color: "#364652", label: "CCTV", style: "cctv" }
    ],
    hidingSpots: [
      { x: 11, y: 2, label: "경비실 캐비닛" }
    ],
    doors: [
      { x: 14, y: 4, to: "1층 복도", tx: 2, ty: 4, label: "1층 복도" }
    ]
  },
  "지하 주차장": {
    cols: 22, rows: 11,
    bg: "#13161c", floorA: "#1e222b", floorB: "#1a1e26", wall: "#3c424f",
    furniture: [
      { x: 2, y: 5, w: 3, h: 2, color: "#3b4c5e", label: "순찰 차량", style: "car" },
      { x: 8, y: 6, w: 2, h: 1, color: "#353b47", label: "분전함", style: "board" },
      { x: 15, y: 6, w: 3, h: 2, color: "#4a3b3b", label: "방치 폐차", style: "car" }
    ],
    hidingSpots: [
      { x: 6, y: 3, label: "콘크리트 기둥" }
    ],
    doors: [
      { x: 10, y: 1, to: "1층 복도", tx: 10, ty: 6, label: "1층 계단" }
    ]
  },
  "엘리베이터": {
    cols: 12, rows: 9,
    bg: "#17161f", floorA: "#2b2936", floorB: "#25232e", wall: "#5e586b",
    furniture: [
      { x: 9, y: 3, w: 1, h: 2, color: "#6b2d38", label: "층수 버튼", style: "panel" }
    ],
    hidingSpots: [],
    doors: [
      { x: 2, y: 4, to: "1층 복도", tx: 17, ty: 3, label: "내리기" }
    ]
  },
  "13층 복도": {
    cols: 26, rows: 9,
    bg: "#161118", floorA: "#241c26", floorB: "#1f1821", wall: "#543944",
    furniture: [
      { x: 4, y: 2, w: 2, h: 1, color: "#4a3338", label: "녹슨 소화전", style: "hydrant" },
      { x: 13, y: 2, w: 2, h: 1, color: "#3d2930", label: "봉인된 1302호", style: "board" },
      { x: 21, y: 6, w: 3, h: 1, color: "#3b2c33", label: "폐가구", style: "desk" }
    ],
    hidingSpots: [
      { x: 7, y: 6, label: "배전함 캐비닛" }
    ],
    doors: [
      { x: 1, y: 4, to: "엘리베이터", tx: 3, ty: 4, label: "엘리베이터" },
      { x: 18, y: 1, to: "1304호 거실", tx: 9, ty: 8, label: "1304호" }
    ]
  },
  "1304호 거실": {
    cols: 18, rows: 10,
    bg: "#21222e", floorA: "#2e2f3d", floorB: "#282936", wall: "#545163",
    furniture: [
      { x: 5, y: 2, w: 3, h: 1, color: "#635144", label: "낡은 소파", style: "sofa" },
      { x: 10, y: 5, w: 3, h: 1, color: "#464759", label: "탁자", style: "desk" }
    ],
    hidingSpots: [
      { x: 2, y: 2, label: "거실 대형 장롱" }
    ],
    doors: [
      { x: 9, y: 8, to: "13층 복도", tx: 18, ty: 2, label: "13층 복도" },
      { x: 16, y: 4, to: "1304호 안방", tx: 2, ty: 4, label: "안방" },
      { x: 9, y: 1, to: "1304호 아이 방", tx: 8, ty: 6, label: "아이 방" }
    ]
  },
  "1304호 안방": {
    cols: 16, rows: 9,
    bg: "#241d26", floorA: "#302733", floorB: "#29212b", wall: "#634d5c",
    furniture: [
      { x: 5, y: 2, w: 4, h: 2, color: "#6e4c56", label: "낡은 침대", style: "bed" },
      { x: 10, y: 2, w: 2, h: 1, color: "#4a3848", label: "화장대", style: "desk" }
    ],
    hidingSpots: [],
    doors: [
      { x: 1, y: 4, to: "1304호 거실", tx: 15, ty: 4, label: "거실" }
    ]
  },
  "1304호 아이 방": {
    cols: 16, rows: 9,
    bg: "#1f2533", floorA: "#2a3242", floorB: "#242b38", wall: "#4f5e75",
    furniture: [
      { x: 3, y: 2, w: 3, h: 2, color: "#465a6e", label: "어린이 침대", style: "bed" },
      { x: 10, y: 5, w: 2, h: 1, color: "#475066", label: "책상", style: "desk" }
    ],
    hidingSpots: [],
    doors: [
      { x: 8, y: 7, to: "1304호 거실", tx: 9, ty: 2, label: "거실" },
      { x: 14, y: 4, to: "1304호 숨겨진 방", tx: 2, ty: 4, label: "숨겨진 방", secret: true }
    ]
  },
  "1304호 숨겨진 방": {
    cols: 16, rows: 9,
    bg: "#141019", floorA: "#211a26", floorB: "#1b1520", wall: "#663f4b",
    furniture: [
      { x: 3, y: 2, w: 3, h: 1, color: "#453139", label: "기록 보관함", style: "desk" },
      { x: 8, y: 2, w: 1, h: 1, color: "#7c8a99", label: "낡은 거울", style: "mirror" }
    ],
    hidingSpots: [],
    doors: [
      { x: 1, y: 4, to: "1304호 아이 방", tx: 13, ty: 4, label: "아이 방" }
    ]
  }
};

const NPCS = [
  { id: "park", name: "박만식", role: "경비원", room: "경비실", x: 4, y: 4, dir: "down" },
  { id: "han", name: "한미정", role: "아파트 주민", room: "1층 복도", x: 6, y: 4, dir: "down" },
  { id: "yoonseo", name: "윤서", role: "정체불명의 소녀", room: "13층 복도", x: 15, y: 3, dir: "down" }
];

/* -------------------------------------------------------------------------
   4. 게임 상태 변수 (추격 AI · 상태 잠금 · 기억 회상 컷신 포함)
   ------------------------------------------------------------------------- */
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
const TILE = 40;

const lightCanvas = document.createElement("canvas");
lightCanvas.width = canvas.width;
lightCanvas.height = canvas.height;
const lctx = lightCanvas.getContext("2d");

let currentRoom = "1층 복도";
let player = {
  x: 4,
  y: 5,
  px: 4 * TILE,
  py: 5 * TILE,
  dir: "down",
  moving: false,
  walkTimer: 0,
  stepParity: 0
};

let camera = { x: 0, y: 0 };

let sanity = 100;
let stamina = 100;

// 구역 형광등 조명 상태: "on" (정상 점등) | "flicker" (점멸 전조) | "out" (정전/암전)
const FLICKER_DURATION = 10.0;
let lightState = "on";
let flickerTimer = 0;
let flickerSfxCooldown = 0;
let currentLightOn = true;

let collected = [];
let deduced = [];
let selectedClues = [];
let pickedFieldItems = [];
let examinedProps = [];
let inventory = { sedative: 1 };
let flags = {};
let activeChoices = [];

let isHiding = false;
let currentHidingLabel = "";
let gameEnded = false;
let endingType = null;
let elevatorFloor = "1층 복도";
let titleActive = true;
let showMinimap = true;

// 프롤로그, 회상 컷신 & 상황 트리거 튜토리얼 상태
let prologueActive = false;
let prologueIndex = 0;
let flashbackActive = false;
let tutorialStep = 0;

// 13번째 방문자(추격자) AI 상태 — 걷기(4.125) < 추격자(4.85) < 질주(6.75)
let ghost = {
  warning: false,
  active: false,
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
};

const keys = {};
const padKeys = { up: false, down: false, left: false, right: false };
let bumpCooldown = 0;
let animTick = 0;
let screenShake = 0;

/* -------------------------------------------------------------------------
   5. 동적 DOM 보강 · 키워드 강조 · 16비트 대화창 포트레이트 일러스트
   ------------------------------------------------------------------------- */
function ensureDynamicDOM() {
  const sp = document.getElementById("speaker");
  const msg = document.getElementById("message");
  const chBox = document.getElementById("choices");
  if (sp && msg && !document.getElementById("dialogue-visual-row")) {
    const parent = msg.parentElement;
    const visualRow = document.createElement("div");
    visualRow.id = "dialogue-visual-row";

    const pFrame = document.createElement("div");
    pFrame.id = "portrait-frame";
    pFrame.innerHTML = `
      <canvas id="portrait-canvas" width="68" height="68"></canvas>
      <div id="portrait-role">SYSTEM</div>
    `;

    const textCol = document.createElement("div");
    textCol.id = "dialogue-text-col";

    parent.insertBefore(visualRow, sp);
    textCol.appendChild(sp);
    textCol.appendChild(msg);
    visualRow.appendChild(pFrame);
    visualRow.appendChild(textCol);

    const tutBanner = document.createElement("div");
    tutBanner.id = "tutorial-banner";
    if (chBox && chBox.parentElement === parent) {
      parent.insertBefore(tutBanner, chBox);
    } else {
      parent.appendChild(tutBanner);
    }
  }

  // 프롤로그 오버레이 DOM
  if (!document.getElementById("prologue-overlay")) {
    const ov = document.createElement("div");
    ov.id = "prologue-overlay";
    ov.innerHTML = `
      <div class="prologue-card">
        <div class="prologue-top">
          <span id="prologue-chapter">PROLOGUE 01</span>
          <span id="prologue-page">1 / 4</span>
        </div>
        <div class="prologue-title" id="prologue-title">도면에 존재하지 않는 층</div>
        <div class="prologue-body-row">
          <canvas id="prologue-art-canvas" width="160" height="110"></canvas>
          <div id="prologue-text"></div>
        </div>
        <div class="prologue-actions">
          <button class="prologue-btn" id="btn-prologue-skip">건너뛰기 [ESC]</button>
          <button class="prologue-btn prologue-btn-primary" id="btn-prologue-next">다음 ▶ [Space]</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    document.getElementById("btn-prologue-skip").onclick = finishPrologue;
    document.getElementById("btn-prologue-next").onclick = advancePrologue;
  }

  // 기억 회상 컷신 오버레이 DOM
  if (!document.getElementById("flashback-overlay")) {
    const fb = document.createElement("div");
    fb.id = "flashback-overlay";
    fb.innerHTML = `
      <div class="flashback-card">
        <div class="prologue-top">
          <span id="flashback-chapter">MEMORY FLASHBACK</span>
          <span>TRUTH UNLOCKED</span>
        </div>
        <div class="prologue-title" id="flashback-title">기억의 조각</div>
        <div class="prologue-body-row">
          <canvas id="flashback-art-canvas" width="160" height="110"></canvas>
          <div id="flashback-text"></div>
        </div>
        <div class="prologue-actions" style="justify-content:flex-end;">
          <button class="prologue-btn prologue-btn-primary" id="btn-flashback-close">기억을 새기고 수사 계속 ▶ [Space]</button>
        </div>
      </div>
    `;
    document.body.appendChild(fb);
    document.getElementById("btn-flashback-close").onclick = closeMemoryFlashback;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatHighlightedDialogue(rawText) {
  let html = escapeHtml(rawText);

  html = html.replace(/\[\[(gold|blue|red|mint):([^\]]+)\]\]/g, (_, cls, inner) => {
    return `<span class="hl-${cls}">${inner}</span>`;
  });

  const rules = [
    {
      cls: "hl-gold",
      regex: /(1985년 10월 13일|1998년 10월 13일|1999년 10월 13일|11시 47분|23:47|1304호|1303호|1302호|1204호|13층|열세 번째|13번째 방문자|방문자 명부|준공 도면|근무일지|녹음기|가족사진|병원 기록|아이의 일기|찢어진 편지|관리비 고지서|추리 질문|핵심 해석)/g
    },
    {
      cls: "hl-blue",
      regex: /(강현우|윤서|박만식|한미정|벽장 뒤|숨겨진 방|낡은 거울|거울|\[H\]|\[E\]|\[C\]|\[M\]|\[Q\])/g
    },
    {
      cls: "hl-red",
      regex: /(형광등이 격렬하게 깜빡|형광등이 불규칙하게 점멸|형광등이 심하게 깜빡|형광등이 깜빡이면|형광등이 깜빡거리면|문을 열지 마|정전|원혼|노크 소리|몸을 숨길 곳이 없다|실종|피로 쓴|GAME OVER|BAD END)/g
    },
    {
      cls: "hl-mint",
      regex: /(은신|숨기|캐비닛|대형 장롱|장롱|콘크리트 기둥|기둥|신경안정제|TRUE END)/g
    }
  ];

  rules.forEach(rule => {
    const parts = html.split(/(<span[^>]*>.*?<\/span>)/g);
    html = parts
      .map(part => {
        if (part.startsWith("<span")) return part;
        return part.replace(rule.regex, m => `<span class="${rule.cls}">${m}</span>`);
      })
      .join("");
  });

  return html.replace(/\n/g, "<br>");
}

/* 대화창 좌측 16비트 픽셀 일러스트(포트레이트) 렌더링 */
function renderSpeakerPortrait(speakerName) {
  const pCanvas = document.getElementById("portrait-canvas");
  const pRole = document.getElementById("portrait-role");
  if (!pCanvas || !pRole) return;

  const pctx = pCanvas.getContext("2d");
  const W = pCanvas.width;
  const H = pCanvas.height;
  pctx.clearRect(0, 0, W, H);

  const name = speakerName || "";
  let kind = "system";
  let roleLabel = "SYSTEM";

  if (name.includes("강현우")) {
    kind = "hero";
    roleLabel = "신입 형사";
  } else if (name.includes("박만식")) {
    kind = "park";
    roleLabel = "경비원";
  } else if (name.includes("한미정")) {
    kind = "han";
    roleLabel = "1204호 주민";
  } else if (name.includes("윤서")) {
    kind = "yoonseo";
    roleLabel = "13층의 소녀";
  } else if (name.includes("방문자") || name.includes("원혼") || name.includes("BAD END") || name.includes("GAME OVER")) {
    kind = "ghost";
    roleLabel = "13번째 방문자";
  } else if (name.includes("단서") || name.includes("수첩") || name.includes("진실") || name.includes("TRUE END")) {
    kind = "clue";
    roleLabel = "수사 기록";
  }

  pRole.textContent = roleLabel;

  const bg = pctx.createLinearGradient(0, 0, 0, H);
  if (kind === "hero") {
    bg.addColorStop(0, "#182438"); bg.addColorStop(1, "#0d131f");
  } else if (kind === "park") {
    bg.addColorStop(0, "#1c2b28"); bg.addColorStop(1, "#0f1715");
  } else if (kind === "han") {
    bg.addColorStop(0, "#2b1d2c"); bg.addColorStop(1, "#140d15");
  } else if (kind === "yoonseo") {
    bg.addColorStop(0, "#262333"); bg.addColorStop(1, "#110f17");
  } else if (kind === "ghost") {
    bg.addColorStop(0, "#3b1019"); bg.addColorStop(1, "#140508");
  } else if (kind === "clue") {
    bg.addColorStop(0, "#2e2618"); bg.addColorStop(1, "#14110b");
  } else {
    bg.addColorStop(0, "#1b2030"); bg.addColorStop(1, "#0d1018");
  }
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, W, H);

  if (kind === "hero") {
    pctx.fillStyle = "#263b59";
    pctx.fillRect(12, 46, 44, 22);
    pctx.fillStyle = "#1b2a40";
    pctx.fillRect(26, 46, 16, 22);
    pctx.fillStyle = "#8FC9FF";
    pctx.fillRect(29, 47, 10, 14);
    pctx.fillStyle = "#141c2b";
    pctx.fillRect(33, 49, 2, 14);
    pctx.fillStyle = "#d9ad91";
    pctx.fillRect(29, 40, 10, 7);
    pctx.fillStyle = "#f2cbb0";
    pctx.fillRect(21, 18, 26, 24);
    pctx.fillStyle = "#161821";
    pctx.fillRect(19, 11, 30, 10);
    pctx.fillRect(19, 18, 4, 15);
    pctx.fillRect(45, 18, 4, 15);
    pctx.fillRect(24, 19, 4, 3);
    pctx.fillRect(36, 19, 5, 3);
    pctx.fillStyle = "#1a1d26";
    pctx.fillRect(24, 26, 6, 2);
    pctx.fillRect(38, 26, 6, 2);
    pctx.fillStyle = "#0e121c";
    pctx.fillRect(26, 29, 3, 4);
    pctx.fillRect(39, 29, 3, 4);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(26, 29, 1, 1);
    pctx.fillRect(39, 29, 1, 1);
    pctx.fillStyle = "#b8826c";
    pctx.fillRect(31, 37, 6, 2);
  } else if (kind === "park") {
    pctx.fillStyle = "#36524d";
    pctx.fillRect(12, 47, 44, 21);
    pctx.fillStyle = "#f2d28b";
    pctx.fillRect(15, 48, 8, 3);
    pctx.fillRect(45, 48, 8, 3);
    pctx.fillStyle = "#d6e0de";
    pctx.fillRect(30, 47, 8, 12);
    pctx.fillStyle = "#cfa184";
    pctx.fillRect(29, 41, 10, 6);
    pctx.fillStyle = "#e0b89d";
    pctx.fillRect(21, 20, 26, 22);
    pctx.fillStyle = "#223330";
    pctx.fillRect(18, 11, 32, 9);
    pctx.fillStyle = "#131c1a";
    pctx.fillRect(17, 19, 34, 3);
    pctx.fillStyle = "#F2D28B";
    pctx.fillRect(32, 14, 4, 4);
    pctx.fillStyle = "#141414";
    pctx.fillRect(25, 28, 3, 3);
    pctx.fillRect(40, 28, 3, 3);
    pctx.fillStyle = "#4a4644";
    pctx.fillRect(28, 35, 12, 2);
  } else if (kind === "han") {
    pctx.fillStyle = "#6e4b6b";
    pctx.fillRect(13, 47, 42, 21);
    pctx.fillStyle = "#e8dfe6";
    pctx.fillRect(28, 47, 12, 14);
    pctx.fillStyle = "#f2cbb0";
    pctx.fillRect(22, 20, 24, 22);
    pctx.fillStyle = "#291b23";
    pctx.fillRect(18, 12, 32, 10);
    pctx.fillRect(18, 19, 5, 24);
    pctx.fillRect(45, 19, 5, 24);
    pctx.fillStyle = "#181216";
    pctx.fillRect(25, 28, 4, 4);
    pctx.fillRect(39, 28, 4, 4);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(26, 28, 1, 1);
    pctx.fillRect(40, 28, 1, 1);
    pctx.fillStyle = "#c4847a";
    pctx.fillRect(31, 37, 6, 2);
  } else if (kind === "yoonseo") {
    pctx.fillStyle = "#dce3ed";
    pctx.fillRect(15, 48, 38, 20);
    pctx.fillStyle = "#b5c0cf";
    pctx.fillRect(28, 48, 12, 6);
    pctx.fillStyle = "#f5e8ea";
    pctx.fillRect(23, 21, 22, 21);
    pctx.fillStyle = "#14131a";
    pctx.fillRect(19, 13, 30, 10);
    pctx.fillRect(19, 20, 4, 28);
    pctx.fillRect(45, 20, 4, 28);
    pctx.fillRect(24, 21, 3, 4);
    pctx.fillRect(40, 21, 3, 4);
    pctx.fillStyle = "#2e1219";
    pctx.fillRect(26, 29, 3, 4);
    pctx.fillRect(39, 29, 3, 4);
    pctx.fillStyle = "#c99ea6";
    pctx.fillRect(32, 37, 4, 2);
  } else if (kind === "ghost") {
    pctx.fillStyle = "rgba(240, 155, 168, 0.22)";
    pctx.beginPath();
    pctx.arc(34, 34, 26, 0, Math.PI * 2);
    pctx.fill();

    pctx.fillStyle = "#17090d";
    pctx.fillRect(16, 14, 36, 48);
    pctx.fillStyle = "#4a1320";
    pctx.fillRect(20, 44, 28, 24);
    pctx.fillStyle = "#F09BA8";
    pctx.fillRect(24, 28, 6, 4);
    pctx.fillRect(38, 28, 6, 4);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(26, 29, 2, 2);
    pctx.fillRect(40, 29, 2, 2);
  } else if (kind === "clue") {
    pctx.fillStyle = "#5c4938";
    pctx.fillRect(16, 16, 28, 36);
    pctx.fillStyle = "#F2D28B";
    pctx.fillRect(19, 19, 22, 30);
    pctx.fillStyle = "#4a3b2c";
    pctx.fillRect(22, 24, 16, 2);
    pctx.fillRect(22, 29, 14, 2);
    pctx.fillRect(22, 34, 12, 2);
    pctx.strokeStyle = "#8FC9FF";
    pctx.lineWidth = 3;
    pctx.beginPath();
    pctx.arc(44, 42, 9, 0, Math.PI * 2);
    pctx.stroke();
    pctx.beginPath();
    pctx.moveTo(50, 48);
    pctx.lineTo(56, 54);
    pctx.stroke();
  } else {
    pctx.strokeStyle = "#8FC9FF";
    pctx.lineWidth = 2;
    pctx.strokeRect(14, 16, 40, 30);
    pctx.fillStyle = "#0e1726";
    pctx.fillRect(16, 18, 36, 26);
    pctx.fillStyle = "#F2D28B";
    pctx.font = "bold 12px monospace";
    pctx.textAlign = "center";
    pctx.fillText("13F", 34, 34);
    pctx.fillStyle = "#8FC9FF";
    pctx.fillRect(26, 49, 16, 4);
  }

  pctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) {
    pctx.fillRect(0, y, W, 1);
  }
}

/* -------------------------------------------------------------------------
   6. 프롤로그, 기억 회상 컷신 & 상황 트리거 튜토리얼 제어
   ------------------------------------------------------------------------- */
function drawSceneArt(canvasId, artType) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;

  g.fillStyle = "#090b14";
  g.fillRect(0, 0, W, H);

  if (artType === "apt_night") {
    g.fillStyle = "#f2d28b";
    g.beginPath();
    g.arc(132, 22, 9, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#1d2233";
    g.fillRect(36, 16, 68, 94);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const is1304 = row === 0 && col === 2;
        g.fillStyle = is1304 ? "#F09BA8" : ((row + col) % 3 === 0 ? "#4f5975" : "#111420");
        g.fillRect(43 + col * 14, 24 + row * 13, 8, 7);
      }
    }
  } else if (artType === "corridor_13") {
    g.fillStyle = "#1a131c";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#543944";
    g.lineWidth = 2;
    g.strokeRect(48, 24, 64, 62);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(48, 24);
    g.moveTo(W, 0); g.lineTo(112, 24);
    g.moveTo(0, H); g.lineTo(48, 86);
    g.moveTo(W, H); g.lineTo(112, 86);
    g.stroke();

    g.fillStyle = "#9ce0b8";
    g.fillRect(72, 14, 16, 6);
    g.fillStyle = "#F09BA8";
    for (let i = 0; i < 6; i++) {
      g.fillRect(18 + i * 4, 48, 2, 16);
    }
  } else if (artType === "knock_door") {
    g.fillStyle = "#261f29";
    g.fillRect(54, 12, 52, 88);
    g.strokeStyle = "#F2D28B";
    g.lineWidth = 1.5;
    g.strokeRect(54, 12, 52, 88);

    g.fillStyle = "#F2D28B";
    g.font = "bold 11px monospace";
    g.textAlign = "center";
    g.fillText("1304", 80, 30);

    g.strokeStyle = "#F09BA8";
    [12, 20, 28].forEach(r => {
      g.beginPath();
      g.arc(80, 56, r, 0, Math.PI * 2);
      g.stroke();
    });
  } else if (artType === "memory_rescue") {
    // 1985년 비상구 앞 기억 복원 컷신
    g.fillStyle = "#1c1824";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#9ce0b8";
    g.fillRect(66, 12, 28, 8);
    // 소년 실루엣 + 손전등 불빛
    g.fillStyle = "rgba(242, 210, 139, 0.16)";
    g.beginPath();
    g.arc(80, 62, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2b4263";
    g.fillRect(68, 56, 24, 32);
    g.fillStyle = "#f2cbb0";
    g.fillRect(71, 36, 18, 18);
    g.fillStyle = "#F2D28B";
    g.font = "bold 10px monospace";
    g.textAlign = "center";
    g.fillText("1985 · 강현우", 80, 102);
  } else if (artType === "memory_yoonseo") {
    // 1304호 벽장 뒤 윤서 기억 컷신
    g.fillStyle = "#1a1726";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#8FC9FF";
    g.strokeRect(46, 18, 68, 74);
    g.fillStyle = "#dce3ed";
    g.fillRect(68, 54, 24, 34);
    g.fillStyle = "#f5e8ea";
    g.fillRect(71, 35, 18, 18);
    g.fillStyle = "#14131a";
    g.fillRect(68, 29, 24, 9);
    g.fillStyle = "#8FC9FF";
    g.font = "bold 10px monospace";
    g.textAlign = "center";
    g.fillText("1304호 · 윤서", 80, 102);
  } else {
    g.fillStyle = "#161b29";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#2b4263";
    g.fillRect(62, 52, 36, 46);
    g.fillStyle = "#8FC9FF";
    g.fillRect(68, 54, 24, 34);
    g.fillStyle = "#f2cbb0";
    g.fillRect(67, 24, 26, 26);
    g.fillStyle = "#161821";
    g.fillRect(65, 16, 30, 12);
    g.fillStyle = "#F2D28B";
    g.font = "bold 11px monospace";
    g.textAlign = "center";
    g.fillText("23:47", 130, 26);
  }
}

function startPrologue() {
  ensureDynamicDOM();
  prologueActive = true;
  prologueIndex = 0;
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "flex";
  renderPrologueScene();
}

function renderPrologueScene() {
  const scene = PROLOGUE_SCENES[prologueIndex];
  if (!scene) {
    finishPrologue();
    return;
  }
  playSfx("step");
  document.getElementById("prologue-chapter").textContent = scene.chapter;
  document.getElementById("prologue-page").textContent = `${prologueIndex + 1} / ${PROLOGUE_SCENES.length}`;
  document.getElementById("prologue-title").textContent = scene.title;
  document.getElementById("prologue-text").innerHTML = formatHighlightedDialogue(scene.text);
  document.getElementById("btn-prologue-next").textContent =
    prologueIndex === PROLOGUE_SCENES.length - 1 ? "수사 시작 ▶ [Space]" : "다음 ▶ [Space]";
  drawSceneArt("prologue-art-canvas", scene.art);
}

function advancePrologue() {
  if (!prologueActive) return;
  prologueIndex++;
  if (prologueIndex >= PROLOGUE_SCENES.length) {
    finishPrologue();
  } else {
    renderPrologueScene();
  }
}

function finishPrologue() {
  prologueActive = false;
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "none";
  playSfx("door");
  startTutorialStep(1);
}

function triggerMemoryFlashback(key) {
  const scene = FLASHBACK_SCENES[key];
  if (!scene) return;
  ensureDynamicDOM();
  flashbackActive = true;
  clearHeldInputs();
  playSfx("flashback");
  document.getElementById("flashback-chapter").textContent = scene.chapter;
  document.getElementById("flashback-title").textContent = scene.title;
  document.getElementById("flashback-text").innerHTML = formatHighlightedDialogue(scene.text);
  drawSceneArt("flashback-art-canvas", scene.art);
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "flex";
}

function closeMemoryFlashback() {
  flashbackActive = false;
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  playSfx("clue");
}

function startTutorialStep(stepNum) {
  if (flags.tutorialDone) return;
  tutorialStep = stepNum;
  renderTutorialBanner();
}

function renderTutorialBanner() {
  const banner = document.getElementById("tutorial-banner");
  if (!banner) return;
  if (tutorialStep <= 0 || tutorialStep > TUTORIAL_STEPS.length || flags.tutorialDone) {
    banner.style.display = "none";
    return;
  }
  const info = TUTORIAL_STEPS[tutorialStep - 1];
  const isLast = tutorialStep === TUTORIAL_STEPS.length;
  banner.style.display = "block";
  banner.innerHTML = `
    <div class="tutorial-header">
      <span>${info.title}</span>
      <span>GUIDE</span>
    </div>
    <div>${formatHighlightedDialogue(info.text)}</div>
    <div class="tutorial-controls">
      <button class="tut-btn" onclick="skipTutorial()">가이드 닫기</button>
      <button class="tut-btn" onclick="advanceTutorialStep()">${isLast ? "확인 ✔" : "다음 ▶"}</button>
    </div>
  `;
}

function advanceTutorialStep() {
  if (tutorialStep <= 0) return;
  playSfx("switch");
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    skipTutorial();
  } else {
    // 1 -> 2 단계까지만 순차 진행하고, 3단계(단서 2개 수집 시)와 4단계(첫 점멸 시)는 상황 트리거로 표시
    if (tutorialStep === 1) {
      tutorialStep = 2;
      renderTutorialBanner();
    } else {
      tutorialStep = 0;
      renderTutorialBanner();
    }
  }
}

function skipTutorial() {
  tutorialStep = 0;
  flags.tutorialDone = true;
  renderTutorialBanner();
}

/* -------------------------------------------------------------------------
   7. 좌표 · 카메라 · BFS 길찾기 유틸리티
   ------------------------------------------------------------------------- */
function clearHeldInputs() {
  Object.keys(keys).forEach(k => { keys[k] = false; });
  padKeys.up = false;
  padKeys.down = false;
  padKeys.left = false;
  padKeys.right = false;
}

function dirToDelta(dir) {
  if (dir === "up") return { dx: 0, dy: -1 };
  if (dir === "down") return { dx: 0, dy: 1 };
  if (dir === "left") return { dx: -1, dy: 0 };
  if (dir === "right") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 1 };
}

function getFacingTile() {
  const { dx, dy } = dirToDelta(player.dir);
  return { x: player.x + dx, y: player.y + dy };
}

function syncPlayerPixelToGrid() {
  player.px = player.x * TILE;
  player.py = player.y * TILE;
  player.moving = false;
  player.walkTimer = 0;
}

function getTargetCamera() {
  const r = ROOMS[currentRoom];
  if (!r) return { x: 0, y: 0 };
  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;

  let tx;
  if (mapW <= canvas.width) {
    tx = -(canvas.width - mapW) / 2;
  } else {
    tx = (player.px + TILE / 2) - canvas.width / 2;
    tx = Math.max(0, Math.min(mapW - canvas.width, tx));
  }

  let ty;
  if (mapH <= canvas.height) {
    ty = -(canvas.height - mapH) / 2;
  } else {
    ty = (player.py + TILE / 2) - canvas.height / 2;
    ty = Math.max(0, Math.min(mapH - canvas.height, ty));
  }

  return { x: tx, y: ty };
}

function snapCamera() {
  const target = getTargetCamera();
  camera.x = target.x;
  camera.y = target.y;
}

function updateCamera(dt) {
  const target = getTargetCamera();
  const lerp = 1 - Math.exp(-12 * dt);
  camera.x += (target.x - camera.x) * lerp;
  camera.y += (target.y - camera.y) * lerp;
  if (Math.abs(target.x - camera.x) < 0.25) camera.x = target.x;
  if (Math.abs(target.y - camera.y) < 0.25) camera.y = target.y;
}

/* 타일 기반 BFS 최단 경로 첫 스텝 계산 (추격자 벽/가구 우회) */
function getNextBfsStep(roomName, startX, startY, goalX, goalY) {
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
      if (!isBlocked(roomName, nx, ny)) {
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

/* -------------------------------------------------------------------------
   8. 타이틀 화면 및 엔딩 기록 관리
   ------------------------------------------------------------------------- */
function getUnlockedEndings() {
  try {
    const raw = localStorage.getItem("visitorEndings");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function recordEndingUnlock(type) {
  const list = getUnlockedEndings();
  if (!list.includes(type)) {
    list.push(type);
    localStorage.setItem("visitorEndings", JSON.stringify(list));
  }
}

function hasValidSaveData() {
  try {
    const raw = localStorage.getItem("visitorSave");
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(data && typeof data === "object");
  } catch (e) {
    return false;
  }
}

function refreshTitleScreen() {
  const preview = document.getElementById("save-preview");
  const loadBtn = document.getElementById("btn-title-load");
  const raw = localStorage.getItem("visitorSave");
  const unlocked = getUnlockedEndings();

  if (!raw) {
    if (preview) preview.textContent = `저장된 데이터 없음 · 달성 엔딩: ${unlocked.length}/3`;
    if (loadBtn) loadBtn.disabled = true;
  } else {
    try {
      const data = JSON.parse(raw);
      const rName = data.currentRoom || data.room || "1층 복도";
      const cCount = Array.isArray(data.collected) ? data.collected.length : 0;
      const dCount = Array.isArray(data.deduced) ? data.deduced.length : 0;
      const savedAt = data.savedAt ? ` (${data.savedAt})` : "";
      if (preview) preview.textContent = `저장 기록: [${rName}] 단서 ${cCount}개 · 진실 ${dCount}개${savedAt} · 엔딩: ${unlocked.length}/3`;
      if (loadBtn) loadBtn.disabled = false;
    } catch (e) {
      if (preview) preview.textContent = "저장 데이터를 읽을 수 없습니다.";
      if (loadBtn) loadBtn.disabled = true;
    }
  }
}

function startNewGameFromTitle() {
  initAudio();
  titleActive = false;
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "none";
  resetGame(true);
}

function continueFromTitle() {
  initAudio();
  titleActive = false;
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "none";
  loadGame();
}

function returnToTitle() {
  titleActive = true;
  prologueActive = false;
  flashbackActive = false;
  activeChoices = [];
  clearHeldInputs();
  const pov = document.getElementById("prologue-overlay");
  if (pov) pov.style.display = "none";
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  ghost.active = false;
  ghost.warning = false;
  lightState = "on";
  refreshTitleScreen();
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "flex";
}

/* -------------------------------------------------------------------------
   9. UI, 단서 해석 비공개 로직 및 로그 출력 도우미
   ------------------------------------------------------------------------- */
function say(speaker, text, speakerClass = "c-system", choices = []) {
  ensureDynamicDOM();
  const sp = document.getElementById("speaker");
  const msg = document.getElementById("message");
  const chBox = document.getElementById("choices");

  if (sp) {
    sp.textContent = speaker;
    sp.className = speakerClass;
  }
  if (msg) {
    msg.innerHTML = formatHighlightedDialogue(text);
    msg.className = "c-npc";
  }

  renderSpeakerPortrait(speaker);

  activeChoices = Array.isArray(choices) ? choices.slice() : [];
  if (activeChoices.length > 0) {
    clearHeldInputs();
  }

  if (chBox) {
    chBox.innerHTML = "";
    activeChoices.forEach((ch, idx) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `[${idx + 1}] ${ch.label}`;
      btn.onclick = () => {
        activeChoices = [];
        chBox.innerHTML = "";
        ch.action();
      };
      chBox.appendChild(btn);
    });
  }
}

function addLog(text) {
  const logBox = document.getElementById("event-log");
  if (!logBox) return;
  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = `• [${currentRoom}] ${text}`;
  logBox.prepend(div);
  while (logBox.children.length > 35) {
    logBox.removeChild(logBox.lastChild);
  }
}

function toggleMinimap() {
  showMinimap = !showMinimap;
  playSfx("switch");
  const btn = document.getElementById("btn-minimap");
  if (btn) btn.textContent = "미니맵: " + (showMinimap ? "ON (M)" : "OFF (M)");
}

function updateClockDisplay() {
  const clockEl = document.getElementById("clock-display");
  if (!clockEl) return;
  clockEl.textContent = "1998년 10월 13일 23:47";
  clockEl.classList.remove("meta-danger");
}

function openEndingGallery() {
  const box = document.getElementById("ending-gallery-box");
  if (!box) return;
  if (box.style.display === "block") {
    box.style.display = "none";
    return;
  }
  const unlocked = getUnlockedEndings();
  const defs = [
    {
      key: "TRUE",
      title: "TRUE END — 마지막 방문자와 사라진 가족의 진실",
      hint: "조건: 단서 9개 이상 + 핵심 진실 4개 이상(윤서/과거 기억 포함) + 인물과 진실 공유 후 거울 직면"
    },
    {
      key: "NORMAL",
      title: "NORMAL END — 봉인된 미제 사건",
      hint: "조건: 단서 5~6개 이상 확보 후 거울 직면 또는 사건 기록 봉인"
    },
    {
      key: "BAD",
      title: "BAD END — 13번째 방문자",
      hint: "조건: 진실이 불충분한 상태에서 노크 소리에 속아 문을 연다"
    }
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

function useConsumable(type) {
  if (gameEnded || titleActive || prologueActive || flashbackActive || activeChoices.length > 0) return;
  if (type === "sedative") {
    if ((inventory.sedative || 0) <= 0) {
      say("SYSTEM", "보유한 신경안정제가 없습니다.", "c-system");
      return;
    }
    if (sanity >= 100) {
      say("강현우", "지금은 정신이 또렷해. 약을 아껴두자.", "c-hero");
      return;
    }
    inventory.sedative--;
    sanity = Math.min(100, sanity + 30);
    playSfx("item");
    addLog("신경안정제를 복용해 정신력을 30 회복했다.");
    say("강현우", "약을 삼키자 거칠던 호흡이 조금씩 가라앉는다. (정신력 +30)", "c-hero");
    renderInventoryUI();
    updateHUD();
  }
}

function changeSanity(delta, reason = "") {
  if (gameEnded) return;
  sanity = Math.max(0, Math.min(100, sanity + delta));
  if (delta < 0) {
    screenShake = Math.min(12, Math.abs(delta));
    if (reason) addLog(`정신력 ${delta} (${reason})`);
  } else if (delta > 0 && reason) {
    addLog(`정신력 +${delta} (${reason})`);
  }
  updateHUD();
  if (sanity <= 0) {
    triggerGameOver("정신 붕괴", "끝없는 환청과 공포에 짓눌린 강현우는 결국 13층의 어둠 속에서 자아를 잃고 말았다.");
  }
}

function updateHUD() {
  const locEl = document.getElementById("top-location");
  if (locEl) locEl.textContent = "장소: 은하아파트 " + currentRoom;

  const sanText = document.getElementById("sanity-text");
  if (sanText) sanText.textContent = `${Math.round(sanity)} / 100`;
  const sBar = document.getElementById("sanity-bar");
  if (sBar) {
    sBar.style.width = `${sanity}%`;
    sBar.style.background = sanity > 60 ? "#8FC9FF" : (sanity > 30 ? "#F2D28B" : "#F09BA8");
  }

  const sanSub = document.getElementById("sanity-status");
  if (sanSub) {
    if (sanity > 60) {
      sanSub.textContent = "심리 안정 상태";
      sanSub.style.color = "#8FC9FF";
    } else if (sanity > 30) {
      sanSub.textContent = "불안 증세 (시야 협소화)";
      sanSub.style.color = "#F2D28B";
    } else {
      sanSub.textContent = "극심한 공황 / 환각 발생";
      sanSub.style.color = "#F09BA8";
    }
  }

  const lightText = document.getElementById("light-text");
  const lightBar = document.getElementById("light-bar");
  const lightStatus = document.getElementById("light-status");
  const r = ROOMS[currentRoom];
  const roomHasHiding = r && r.hidingSpots && r.hidingSpots.length > 0;

  if (lightText && lightBar && lightStatus) {
    if (lightState === "flicker") {
      const pct = Math.max(0, Math.round((flickerTimer / FLICKER_DURATION) * 100));
      lightText.textContent = `⚡ 점멸 경고 (${flickerTimer.toFixed(1)}초)`;
      lightText.style.color = "#F2D28B";
      lightBar.style.width = `${pct}%`;
      lightBar.style.background = "#F2D28B";
      if (isHiding) {
        lightStatus.textContent = "은신 완료! 불이 꺼져도 숨을 죽이세요";
        lightStatus.style.color = "#9ce0b8";
      } else if (roomHasHiding) {
        lightStatus.textContent = "시야 밖 은신처로 이동해 숨거나 구역을 벗어나세요 [H]!";
        lightStatus.style.color = "#F09BA8";
      } else {
        lightStatus.textContent = "숨을 곳 없음! 문을 통해 다른 구역으로 벗어나세요!";
        lightStatus.style.color = "#F09BA8";
      }
    } else if (lightState === "out") {
      lightText.textContent = "정전 / 암전";
      lightText.style.color = "#F09BA8";
      lightBar.style.width = "0%";
      lightBar.style.background = "#F09BA8";
      lightStatus.textContent = ghost.active ? "13번째 방문자 추격 중! 은신하거나 두 구역 이상 도주!" : "조명이 꺼진 어두운 공간";
      lightStatus.style.color = "#F09BA8";
    } else {
      lightText.textContent = "정상 점등";
      lightText.style.color = "#8FC9FF";
      lightBar.style.width = "100%";
      lightBar.style.background = "#8FC9FF";
      lightStatus.textContent = "형광등 점등 (불이 깜빡이면 은신 또는 구역 이탈)";
      lightStatus.style.color = "#8FC9FF";
    }
  }

  const stamText = document.getElementById("stamina-text");
  const stamBar = document.getElementById("stamina-bar");
  if (stamText) stamText.textContent = `${Math.round(stamina)}%`;
  if (stamBar) stamBar.style.width = `${stamina}%`;

  const st = document.getElementById("state-text");
  const flickerBanner = document.getElementById("flicker-banner");
  const dangerBanner = document.getElementById("danger-banner");

  if (st) {
    if (gameEnded) {
      st.textContent = endingType ? `엔딩: ${endingType} END` : "GAME OVER";
      st.style.color = "#F2D28B";
      if (flickerBanner) flickerBanner.style.display = "none";
      if (dangerBanner) dangerBanner.style.display = "none";
    } else if (lightState === "flicker") {
      st.textContent = isHiding ? `은신 완료 (${currentHidingLabel})` : "⚡ 조명 점멸! 은신/이탈 필요!";
      st.style.color = isHiding ? "#9ce0b8" : "#F2D28B";
      if (flickerBanner) flickerBanner.style.display = isHiding ? "none" : "block";
      if (dangerBanner) dangerBanner.style.display = "none";
    } else if (ghost.active) {
      st.textContent = isHiding ? `은신 중 (${currentHidingLabel})` : "⚠ 13번째 방문자 추격 중!";
      st.style.color = "#F09BA8";
      if (flickerBanner) flickerBanner.style.display = "none";
      if (dangerBanner) dangerBanner.style.display = "block";
    } else if (isHiding) {
      st.textContent = `은신 중 (${currentHidingLabel})`;
      st.style.color = "#F2D28B";
      if (flickerBanner) flickerBanner.style.display = "none";
      if (dangerBanner) dangerBanner.style.display = "none";
    } else {
      st.textContent = "수사 진행 중";
      st.style.color = "#8FC9FF";
      if (flickerBanner) flickerBanner.style.display = "none";
      if (dangerBanner) dangerBanner.style.display = "none";
    }
  }

  const progEl = document.getElementById("progress-text");
  if (progEl) {
    progEl.textContent = `단서 ${collected.length}/${CLUES.length} · 진실 ${deduced.length}/${COMBINATIONS.length}`;
  }

  const unlocked = getUnlockedEndings();
  const endEl = document.getElementById("ending-tracker");
  if (endEl) {
    endEl.textContent = `달성 엔딩: ${unlocked.length} / 3` + (unlocked.length ? ` (${unlocked.join(", ")})` : "");
  }

  const propEl = document.getElementById("prop-tracker");
  if (propEl) {
    propEl.textContent = `환경 단서 조사: ${examinedProps.length} / ${PROPS.length}`;
  }

  const sedCount = inventory.sedative || 0;
  const btnSed = document.getElementById("btn-use-sedative");
  if (btnSed) {
    btnSed.textContent = `신경안정제 [Q] (${sedCount})`;
    btnSed.disabled = sedCount <= 0;
  }
}

function renderInventoryUI() {
  const bag = document.getElementById("item-bag");
  if (!bag) return;
  const sedCount = inventory.sedative || 0;
  bag.innerHTML = `
    <div class="bag-row">
      <div class="bag-info">
        <span class="bag-name">신경안정제 × ${sedCount}</span>
        <span class="bag-desc">복용 시 정신력 +30 회복 (단축키: Q)</span>
      </div>
      <button onclick="useConsumable('sedative')" ${sedCount <= 0 ? "disabled" : ""}>사용</button>
    </div>
    <div class="bag-row">
      <div class="bag-info">
        <span class="bag-name">수사관 수칙 메모</span>
        <span class="bag-desc">형광등 점멸(10초) 시 시야 밖 은신처에서 [H]로 숨거나 두 구역 이상 벗어나세요.</span>
      </div>
    </div>
  `;
}

function isClueInterpreted(clue) {
  if (!clue || !Array.isArray(clue.truthIds)) return false;
  return clue.truthIds.some(tid => deduced.includes(tid));
}

function getClueDisplayDescription(clue) {
  if (!clue) return "";
  if (clue.id === "car_memo" && deduced.includes("combo_past")) {
    return clue.description.replace("□□□", "[[blue:강현우]]");
  }
  return clue.description;
}

function renderClueUI() {
  const list = document.getElementById("clue-list");
  if (list) {
    if (collected.length === 0) {
      list.textContent = "수집한 단서가 없습니다.";
    } else {
      list.innerHTML = "";
      collected.forEach(id => {
        const c = CLUES.find(item => item.id === id);
        if (!c) return;
        const interpreted = isClueInterpreted(c);
        const chip = document.createElement("div");
        chip.className = "clue-chip" + (selectedClues.includes(id) ? " selected" : "");
        chip.textContent = interpreted ? `✔ ${c.name}` : c.name;
        chip.title = interpreted
          ? `[해석 완료] ${c.importance}`
          : `[추리 질문] ${c.comboHint}`;
        chip.onclick = () => toggleSelectClue(id);
        list.appendChild(chip);
      });
    }
  }

  const dedBox = document.getElementById("deduction-list");
  if (dedBox) {
    if (deduced.length === 0) {
      dedBox.textContent = "아직 조합으로 밝혀낸 진실이 없습니다.";
    } else {
      dedBox.innerHTML = deduced.map(did => {
        const d = COMBINATIONS.find(x => x.id === did);
        return d ? `<div class="deduction-item"><strong>${d.title}</strong><br><span>${d.summary}</span></div>` : "";
      }).join("");
    }
  }
}

function toggleSelectClue(id) {
  if (activeChoices.length > 0 || prologueActive || flashbackActive) return;
  const c = CLUES.find(item => item.id === id);
  if (selectedClues.includes(id)) {
    selectedClues = selectedClues.filter(x => x !== id);
  } else {
    if (selectedClues.length >= 2) selectedClues.shift();
    selectedClues.push(id);
    if (c) {
      const desc = getClueDisplayDescription(c);
      const extraLine = isClueInterpreted(c)
        ? `• [[gold:핵심 해석]]: ${c.importance}`
        : `• [[mint:추리 질문]]: ${c.comboHint}`;
      say("수사 수첩", `[${c.name}]\n${desc}\n\n${extraLine}`, "c-clue");
    }
  }
  renderClueUI();
}

function combineSelectedClues() {
  if (gameEnded || titleActive || prologueActive || flashbackActive || activeChoices.length > 0) return;
  if (selectedClues.length < 2) {
    say("SYSTEM", "수사 수첩에서 서로 연관된 단서 2개를 클릭해 선택한 뒤 조합해 주세요.\n(각 단서를 클릭하면 하단에 [[mint:추리 질문]]이 표시됩니다.)", "c-system");
    return;
  }
  const [a, b] = selectedClues;
  const match = COMBINATIONS.find(c =>
    (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a)
  );

  selectedClues = [];
  renderClueUI();

  if (tutorialStep === 3) {
    tutorialStep = 0;
    renderTutorialBanner();
  }

  if (!match) {
    playSfx("bump");
    changeSanity(-5, "잘못된 추리 조합으로 인한 혼란");
    if (!gameEnded) {
      say("강현우", "억지로 끼워 맞춘 가설이야... 머리가 지끈거린다. 각 단서의 [[mint:추리 질문]]을 다시 읽어보자. (정신력 -5)", "c-hero");
    }
    return;
  }

  if (deduced.includes(match.id)) {
    say("SYSTEM", `이미 도출한 진실입니다.\n\n${match.title}\n${match.summary}`, "c-system");
    return;
  }

  deduced.push(match.id);
  playSfx("combo");
  if (match.onUnlock) match.onUnlock();
  addLog(`새로운 진실 도출: ${match.title}`);
  renderClueUI();
  updateHUD();
  autoSaveGame();

  say("진실 해금", `증거 조합 성공! 새로운 진실이 수첩에 기록되었다.\n\n${match.title}\n${match.summary}`, "c-clue");
}

function openDeductionSummary() {
  if (activeChoices.length > 0 || prologueActive || flashbackActive) return;
  if (collected.length === 0) {
    say("수사 수첩", "아직 수집된 단서가 없습니다. 주변 사물과 주민들을 조사하세요.", "c-system");
    return;
  }
  const lines = collected.map(id => {
    const c = CLUES.find(item => item.id === id);
    if (isClueInterpreted(c)) {
      return `■ ${c.name} [해석 완료]: ${c.importance}`;
    }
    return `□ ${c.name}: ${c.comboHint}`;
  }).join("\n");
  say("수사 수첩 요약", `현재 확보된 단서 (${collected.length}/${CLUES.length}) · 도출 진실 (${deduced.length}/${COMBINATIONS.length})\n\n${lines}`, "c-clue");
}

/* -------------------------------------------------------------------------
   10. 타일 보간 이동, 충돌 검사, 은신 및 구역 이탈 전환
   ------------------------------------------------------------------------- */
function isBlocked(roomName, tx, ty) {
  const r = ROOMS[roomName];
  if (!r) return true;
  if (tx < 1 || tx > r.cols - 2 || ty < 1 || ty > r.rows - 2) return true;

  for (const f of r.furniture) {
    if (tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.h) return true;
  }
  for (const n of NPCS) {
    if (n.room === roomName && n.x === tx && n.y === ty) return true;
  }
  return false;
}

function findNearestWalkable(roomName, sx, sy) {
  const r = ROOMS[roomName];
  if (!r) return { x: 4, y: 4 };
  if (!isBlocked(roomName, sx, sy)) return { x: sx, y: sy };

  const visited = new Set();
  const queue = [{ x: sx, y: sy }];
  visited.add(`${sx},${sy}`);

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (nx >= 1 && nx <= r.cols - 2 && ny >= 1 && ny <= r.rows - 2) {
        if (!isBlocked(roomName, nx, ny)) return { x: nx, y: ny };
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return { x: 3, y: 4 };
}

function setPadDir(dir, isDown) {
  if (activeChoices.length > 0 || prologueActive || flashbackActive) return;
  padKeys[dir] = isDown;
}

function isShiftHeld() {
  return Boolean(keys["ShiftLeft"] || keys["ShiftRight"]);
}

function startStep(dx, dy, isSprinting = false) {
  if (gameEnded || titleActive || prologueActive || flashbackActive || activeChoices.length > 0) return false;
  if (isHiding) {
    if (bumpCooldown <= 0) {
      bumpCooldown = 0.45;
      say("SYSTEM", "숨어 있는 상태에서는 이동할 수 없습니다. [H] 키 또는 [숨기/나오기]를 눌러 먼저 나오세요.", "c-system");
    }
    return false;
  }
  if (player.moving) return false;

  if (dx < 0) player.dir = "left";
  else if (dx > 0) player.dir = "right";
  else if (dy < 0) player.dir = "up";
  else if (dy > 0) player.dir = "down";

  const nx = player.x + dx;
  const ny = player.y + dy;

  const r = ROOMS[currentRoom];
  const door = r.doors.find(d => d.x === nx && d.y === ny);
  if (door) {
    if (bumpCooldown <= 0) {
      bumpCooldown = 0.32;
      handleDoorTransition(door);
    }
    return false;
  }

  if (isBlocked(currentRoom, nx, ny)) {
    if (bumpCooldown <= 0) {
      bumpCooldown = 0.35;
      playSfx("bump");
    }
    return false;
  }

  player.x = nx;
  player.y = ny;
  player.moving = true;
  player.walkTimer = 0;
  player.stepParity = 1 - player.stepParity;
  playSfx("step");

  if (tutorialStep === 1) {
    advanceTutorialStep();
  }

  if (isSprinting) {
    stamina = Math.max(0, stamina - 8);
  }
  return true;
}

function getHeldDirection() {
  if (activeChoices.length > 0 || prologueActive || flashbackActive) return null;
  if (keys["ArrowUp"] || keys["KeyW"] || padKeys.up) return { dx: 0, dy: -1 };
  if (keys["ArrowDown"] || keys["KeyS"] || padKeys.down) return { dx: 0, dy: 1 };
  if (keys["ArrowLeft"] || keys["KeyA"] || padKeys.left) return { dx: -1, dy: 0 };
  if (keys["ArrowRight"] || keys["KeyD"] || padKeys.right) return { dx: 1, dy: 0 };
  return null;
}

function updatePlayerMovement(dt) {
  if (bumpCooldown > 0) bumpCooldown = Math.max(0, bumpCooldown - dt);

  const isSprinting = (isShiftHeld() && stamina > 5 && !isHiding);
  const moveSpeed = isSprinting ? 270 : 165;

  if (player.moving) {
    player.walkTimer += dt * (isSprinting ? 1.55 : 1.0);
    const targetPx = player.x * TILE;
    const targetPy = player.y * TILE;
    const dx = targetPx - player.px;
    const dy = targetPy - player.py;
    const dist = Math.hypot(dx, dy);
    const step = moveSpeed * dt;

    if (dist <= step) {
      player.px = targetPx;
      player.py = targetPy;
      player.moving = false;
      checkStepEvents();

      if (!gameEnded && !titleActive && !prologueActive && !flashbackActive && activeChoices.length === 0) {
        const held = getHeldDirection();
        if (held) {
          startStep(held.dx, held.dy, isSprinting);
        }
      }
    } else {
      player.px += (dx / dist) * step;
      player.py += (dy / dist) * step;
    }
  } else {
    player.walkTimer = 0;
    const held = getHeldDirection();
    if (held) {
      startStep(held.dx, held.dy, isSprinting);
    }
  }

  if (!player.moving || !isSprinting) {
    stamina = Math.min(100, stamina + 18 * dt);
  }
}

function handleDoorTransition(door) {
  // 1. 추격/점멸 중 엘리베이터 진입 차단 (두 구역 이상 따돌리지 않으면 승강기 봉쇄)
  if (door.to === "엘리베이터" && (ghost.active || ghost.warning)) {
    playSfx("ghost");
    say("SYSTEM", "엘리베이터 문이 굳게 닫혀 열리지 않는다!\n원혼의 기운이 승강기를 붙잡고 있다. 복도나 방의 은신처에 숨어야 한다 [H]!", "c-ghost");
    return;
  }

  // 2. 1304호 현관문 잠금 (단순 소지가 아닌 진실 조합 해금 또는 윤서 조우 필요)
  if (door.to === "1304호 거실" && currentRoom === "13층 복도" && !flags.door1304Unlocked) {
    if (deduced.includes("combo_space") || deduced.includes("combo_coverup") || flags.metYoonseo) {
      flags.door1304Unlocked = true;
      playSfx("door");
      addLog("13층의 비밀을 파악하고 굳게 닫혀 있던 1304호 현관문을 열었다.");
    } else {
      say("SYSTEM", "1304호 철문이 굳게 잠겨 있다.\n13층의 존재와 방화문 봉쇄에 관한 단서들을 조합해 진실을 밝히거나, 복도의 소녀에게 말을 걸어보자.", "c-system");
      return;
    }
  }

  // 3. 아이 방 -> 숨겨진 방 비밀 통로 (반드시 편지 + 일기 조합 진실 3 해금 필요)
  if (door.secret && !flags.secretOpen) {
    if (deduced.includes("combo_secret")) {
      flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤의 비밀 통로가 열렸다!");
    } else {
      say("SYSTEM", "벽장 뒤에서 차가운 바람이 새어 나오지만 굳게 막혀 있다.\n수사 수첩에서 관련 단서들을 조합해 벽장 뒤의 진실을 먼저 밝혀야 한다.", "c-system");
      return;
    }
  }

  const prevRoom = currentRoom;
  currentRoom = door.to;
  player.x = door.tx;
  player.y = door.ty;
  syncPlayerPixelToGrid();
  snapCamera();
  playSfx("door");

  if (currentRoom === "엘리베이터") {
    elevatorFloor = prevRoom === "지하 주차장" ? "지하 주차장" : (prevRoom === "13층 복도" ? "13층 복도" : "1층 복도");
    openElevatorMenu();
    return;
  }

  // 추격 중 구역 이동: 1층 복도/경비실이라도 무조건 안전하지 않으며, 2회 이상 구역을 넘어가야 따돌림!
  if (ghost.warning || ghost.active) {
    ghost.escapeRoomCount = (ghost.escapeRoomCount || 0) + 1;
    const shookOffByDistance = ghost.escapeRoomCount >= 2;

    if (shookOffByDistance) {
      ghost.warning = false;
      ghost.active = false;
      ghost.escapeRoomCount = 0;
      lightState = "on";
      playSfx("light_on");
      changeSanity(4, "연속 구역 이탈로 추격 따돌림");
      addLog("두 구역을 연속으로 벗어나 13번째 방문자의 추적을 따돌렸다!");
      say("SYSTEM", "거친 숨을 몰아쉬며 추격자의 시야에서 완전히 벗어났다! 형광등이 다시 정상적으로 켜졌다.", "c-system");
      if (tutorialStep === 4) {
        tutorialStep = 0;
        renderTutorialBanner();
      }
      autoSaveGame();
    } else {
      ghost.room = currentRoom;
      const destHasHide = ROOMS[currentRoom] && ROOMS[currentRoom].hidingSpots.length > 0;
      if (ghost.warning) {
        lightState = "flicker";
        ghost.spawnX = door.tx;
        ghost.spawnY = door.ty;
        const extraGuide = destHasHide
          ? "이 구역의 은신처에 숨거나 한 구역 더 벗어나세요 [H]!"
          : "이곳에도 숨을 곳이 없다! 다음 문으로 한 구역 더 도망치세요!";
        addLog(`${currentRoom}으로 빠져나왔다! ${extraGuide}`);
        say("SYSTEM", `${currentRoom}의 형광등까지 심하게 깜빡인다! ${extraGuide}`, "c-system");
      } else {
        lightState = "out";
        ghost.px = door.tx * TILE;
        ghost.py = door.ty * TILE;
        ghost.entryDelay = 0.85;
        addLog(`정전된 어둠을 틈타 13번째 방문자가 ${currentRoom}까지 쫓아왔다! 한 구역 더 벗어나거나 숨으세요!`);
        say("13번째 방문자", `문틈 너머로 무거운 발소리가 따라 들어왔다! 한 구역 더 도망치거나 은신처에 숨어라!`, "c-ghost");
      }
    }
  } else {
    lightState = currentRoom === "1304호 숨겨진 방" ? "out" : "on";
    say("SYSTEM", `${currentRoom}에 들어왔다.`, "c-system");
    autoSaveGame();
  }

  if (currentRoom === "1304호 숨겨진 방" && !flags.visitedSecret) {
    flags.visitedSecret = true;
    changeSanity(-6, "숨겨진 방의 음산한 기운");
  }

  updateHUD();
}

function openElevatorMenu() {
  say(
    "SYSTEM",
    `엘리베이터 내부다. 현재 층: [${elevatorFloor}]\n조작반 맨 아래에는 도면에 없는 붉은색 [13층] 버튼이 희미하게 빛나고 있다.`,
    "c-system",
    [
      {
        label: "1층 복도로 이동",
        action: () => {
          currentRoom = "1층 복도";
          lightState = "on";
          player.x = 17; player.y = 3;
          player.dir = "left";
          syncPlayerPixelToGrid();
          snapCamera();
          playSfx("door");
          say("SYSTEM", "엘리베이터 문이 열리고 1층 복도로 나왔다.", "c-system");
          autoSaveGame();
          updateHUD();
        }
      },
      {
        label: "지하 주차장으로 이동",
        action: () => {
          currentRoom = "지하 주차장";
          lightState = "on";
          player.x = 10; player.y = 2;
          player.dir = "down";
          syncPlayerPixelToGrid();
          snapCamera();
          playSfx("door");
          say("SYSTEM", "축축한 곰팡이 냄새가 진동하는 지하 주차장에 도착했다.", "c-system");
          autoSaveGame();
          updateHUD();
        }
      },
      {
        label: "붉은 [13층] 버튼을 누른다",
        action: () => {
          currentRoom = "13층 복도";
          lightState = "on";
          player.x = 2; player.y = 4;
          player.dir = "right";
          syncPlayerPixelToGrid();
          snapCamera();
          playSfx("ghost");
          if (!flags.visited13F) {
            flags.visited13F = true;
            changeSanity(-7, "존재하지 않는 13층 진입");
            addLog("엘리베이터가 굉음을 내며 멈추고, 13층 복도가 모습을 드러냈다.");
          }
          say("강현우", "분명 도면엔 12층까지밖에 없었는데... 복도 형광등이 불안하게 윙윙거리고 있어.", "c-hero");
          autoSaveGame();
          updateHUD();
        }
      }
    ]
  );
  updateHUD();
}

function toggleHide() {
  if (gameEnded || titleActive || prologueActive || flashbackActive || activeChoices.length > 0) return;
  const r = ROOMS[currentRoom];
  if (isHiding) {
    if (ghost.active || lightState === "flicker") {
      say("SYSTEM", "아직 바깥에 추격자의 발소리가 남아 있습니다! 불이 다시 켜질 때까지 숨을 죽이세요.", "c-ghost");
      return;
    }
    isHiding = false;
    currentHidingLabel = "";
    playSfx("hide");
    say("SYSTEM", "숨어 있던 곳에서 조심스럽게 나왔다.", "c-system");
    updateHUD();
    return;
  }

  const facing = getFacingTile();
  const spot =
    r.hidingSpots.find(s => s.x === facing.x && s.y === facing.y) ||
    r.hidingSpots.find(s => Math.abs(s.x - player.x) + Math.abs(s.y - player.y) <= 1);

  if (!spot) {
    say("SYSTEM", "이 주변에는 몸을 숨길 곳이 없다! 은신처가 있는 구역으로 이동하거나 문을 통해 벗어나야 한다.", "c-system");
    return;
  }

  // 추격자가 코앞(시야 2.3타일 이내)에서 보고 있을 때는 은신 발각!
  if (ghost.active && ghost.room === currentRoom && ghost.entryDelay <= 0) {
    const dist = Math.hypot(ghost.px - player.px, ghost.py - player.py);
    if (dist < TILE * 2.3) {
      playSfx("ghost");
      say("13번째 방문자", "너무 가깝다! 추격자가 지켜보는 앞에서 은신처에 들어갈 수 없다!", "c-ghost");
      return;
    }
  }

  isHiding = true;
  player.moving = false;
  currentHidingLabel = spot.label;
  playSfx("hide");
  addLog(`${spot.label} 안에 몸을 숨겼다.`);

  if (tutorialStep === 4) {
    tutorialStep = 0;
    renderTutorialBanner();
  }

  if (lightState === "flicker") {
    say("SYSTEM", `형광등이 꺼지기 직전 [${spot.label}] 안에 몸을 숨겼다! 불이 다시 들어올 때까지 움직이지 말자.`, "c-system");
  } else {
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼다. 숨소리를 죽이고 기척이 사라지길 기다리자.`, "c-system");
  }
  updateHUD();
}

function checkStepEvents() {
  // 지하 주차장: 수사 메모 획득 후 출구 이동 시 첫 형광등 점멸 경고 (튜토리얼 4단계 연동)
  if (currentRoom === "지하 주차장" && collected.includes("car_memo") && !flags.parkingGhostSeen && player.x >= 12) {
    flags.parkingGhostSeen = true;
    startGhostWarning(
      "지하 주차장",
      18,
      4,
      "지하 주차장 형광등이 지지직거리며 심하게 깜빡이기 시작했다! 콘크리트 기둥 뒤에 숨거나 1층 계단으로 빠르게 벗어나라 [H]!",
      "형광등이 펑 하고 터지며 정전되었다! 어둠 속에서 13번째 방문자가 발소리를 울리며 다가온다!"
    );
    return;
  }

  // 13층 복도: 단서 4개 이상 확보 후 중앙 통과 시 점멸 경고
  if (currentRoom === "13층 복도" && collected.length >= 4 && !flags.hallGhostSeen && player.x >= 11 && player.x <= 18) {
    flags.hallGhostSeen = true;
    startGhostWarning(
      "13층 복도",
      22,
      4,
      "13층 복도의 형광등이 불규칙하게 점멸하며 스파크가 튄다! 서둘러 은신처를 찾거나 문을 통해 구역을 벗어나라 [H]!",
      "복도 조명이 완전히 꺼졌다! 암전 속에서 13번째 방문자가 거친 숨소리와 함께 달려온다!"
    );
    return;
  }

  // 1304호 안방: 병원 기록 확보 후 나올 때 점멸 경고 (은신처 없는 방 -> 거실 장롱으로 이탈 유도)
  if (currentRoom === "1304호 안방" && collected.includes("medical") && !flags.masterGhostSeen && player.x <= 6) {
    flags.masterGhostSeen = true;
    startGhostWarning(
      "1304호 안방",
      13,
      4,
      "안방 형광등이 격렬하게 깜빡이기 시작한다! 이 방에는 몸을 숨길 곳이 없다! 문을 통해 거실로 벗어나 숨어라!",
      "안방 불이 꺼지며 어둠 속에서 13번째 방문자가 솟아올랐다!"
    );
    return;
  }

  // 1304호 거실: 방문자 명부 획득 후 귀환 시 점멸 경고
  if (currentRoom === "1304호 거실" && collected.includes("ledger") && !flags.houseGhostSeen) {
    flags.houseGhostSeen = true;
    startGhostWarning(
      "1304호 거실",
      15,
      4,
      "현관 쪽에서 세 번의 노크 소리가 울리더니 거실 형광등이 심하게 깜빡인다! 시야 밖 은신처에 숨거나 복도로 벗어나라 [H]!",
      "거실 불이 완전히 꺼졌다! 정전된 거실로 13번째 방문자가 들이닥쳤다!"
    );
  }
}

/* -------------------------------------------------------------------------
   11. 전방 타일 정밀 조사 & NPC 단계별 상호작용
   ------------------------------------------------------------------------- */
function findInteractableAt(tx, ty) {
  const r = ROOMS[currentRoom];
  if (!r) return null;

  const door = r.doors.find(d => d.x === tx && d.y === ty && (!d.secret || flags.secretOpen));
  if (door) return { type: "door", target: door, x: door.x, y: door.y };

  if (currentRoom === "엘리베이터" && tx === 9 && (ty === 3 || ty === 4)) {
    return { type: "elevator_panel", x: 9, y: ty };
  }

  const npc = NPCS.find(n => n.room === currentRoom && n.x === tx && n.y === ty);
  if (npc) return { type: "npc", target: npc, x: npc.x, y: npc.y };

  const clue = CLUES.find(c => c.room === currentRoom && !collected.includes(c.id) && c.x === tx && c.y === ty);
  if (clue) return { type: "clue", target: clue, x: clue.x, y: clue.y };

  const fItem = FIELD_ITEMS.find(it => it.room === currentRoom && !pickedFieldItems.includes(it.id) && it.x === tx && it.y === ty);
  if (fItem) return { type: "item", target: fItem, x: fItem.x, y: fItem.y };

  if (currentRoom === "1304호 숨겨진 방" && tx === 8 && ty === 2) {
    return { type: "mirror", x: 8, y: 2 };
  }

  const prop = PROPS.find(p => p.room === currentRoom && p.x === tx && p.y === ty);
  if (prop) return { type: "prop", target: prop, x: prop.x, y: prop.y };

  const spot = r.hidingSpots.find(s => s.x === tx && s.y === ty);
  if (spot) return { type: "hiding", target: spot, x: spot.x, y: spot.y };

  if (currentRoom === "1304호 아이 방" && tx === 14 && ty === 4 && !flags.secretOpen) {
    return { type: "secret_wall", x: 14, y: 4 };
  }

  return null;
}

function getBestInteractTarget() {
  const facing = getFacingTile();
  const frontHit = findInteractableAt(facing.x, facing.y);
  if (frontHit) return frontHit;

  const underHit = findInteractableAt(player.x, player.y);
  if (underHit && underHit.type !== "door") return underHit;

  const dirs = ["down", "up", "left", "right"];
  for (const d of dirs) {
    if (d === player.dir) continue;
    const { dx, dy } = dirToDelta(d);
    const sideHit = findInteractableAt(player.x + dx, player.y + dy);
    if (sideHit && sideHit.type !== "door") return sideHit;
  }

  return null;
}

function interact() {
  if (gameEnded || titleActive || prologueActive || flashbackActive || activeChoices.length > 0) return;
  if (isHiding) {
    toggleHide();
    return;
  }

  const hit = getBestInteractTarget();
  if (!hit) {
    say("강현우", "주변을 꼼꼼히 살펴보았지만 더 이상 특이한 점은 보이지 않는다.", "c-hero");
    return;
  }

  if (tutorialStep === 2) {
    advanceTutorialStep();
  }

  if (hit.x !== player.x || hit.y !== player.y) {
    const dx = hit.x - player.x;
    const dy = hit.y - player.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      player.dir = dx < 0 ? "left" : "right";
    } else {
      player.dir = dy < 0 ? "up" : "down";
    }
  }

  if (hit.type === "door") {
    handleDoorTransition(hit.target);
    return;
  }

  if (hit.type === "elevator_panel") {
    openElevatorMenu();
    return;
  }

  if (hit.type === "npc") {
    const opp = { up: "down", down: "up", left: "right", right: "left" };
    hit.target.dir = opp[player.dir] || "down";
    talkToNPC(hit.target);
    return;
  }

  if (hit.type === "clue") {
    const clue = hit.target;
    collected.push(clue.id);
    playSfx("clue");
    addLog(`단서 획득: [${clue.name}]`);
    renderClueUI();
    updateHUD();

    // 단서 2개 수집 시 상황 트리거로 튜토리얼 3단계 안내
    if (collected.length === 2 && !flags.tutorialStep3Shown && !flags.tutorialDone) {
      flags.tutorialStep3Shown = true;
      startTutorialStep(3);
    }

    autoSaveGame();

    say(
      "중요 단서",
      `[${clue.name}]을(를) 발견했다!\n\n${getClueDisplayDescription(clue)}\n\n• [[mint:추리 질문]]: ${clue.comboHint}`,
      "c-clue"
    );

    if (clue.id === "recording" || clue.id === "ledger") {
      changeSanity(-5, "충격적인 진실의 단서");
    }
    return;
  }

  if (hit.type === "item") {
    const fItem = hit.target;
    pickedFieldItems.push(fItem.id);
    inventory[fItem.type] = (inventory[fItem.type] || 0) + 1;
    playSfx("item");
    addLog(`소지품 획득: [${fItem.name}]`);
    renderInventoryUI();
    updateHUD();
    autoSaveGame();
    say("SYSTEM", `소지품 [${fItem.name}]을(를) 획득했다!\n\n${fItem.desc}`, "c-system");
    return;
  }

  if (hit.type === "mirror") {
    triggerFinalMirrorEvent();
    return;
  }

  if (hit.type === "prop") {
    const prop = hit.target;
    const firstTime = !examinedProps.includes(prop.id);
    if (firstTime) {
      examinedProps.push(prop.id);
      addLog(`현장 조사: [${prop.name}]`);
      if (prop.sanityDelta) {
        changeSanity(prop.sanityDelta, prop.sanityReason);
      }
      if (examinedProps.length >= PROPS.length && !flags.allPropsExamined) {
        flags.allPropsExamined = true;
        changeSanity(10, "아파트 전체 현장 정밀 조사 완료");
        addLog("모든 환경 단서(8/8)를 조사해 사건의 전체 맥락을 꿰뚫었다!");
      }
    }
    playSfx("step");
    updateHUD();
    say(prop.speaker, `[${prop.name}]\n${prop.text}`, prop.speakerClass);
    return;
  }

  if (hit.type === "hiding") {
    say("SYSTEM", `[${hit.target.label}]이다. 형광등이 깜빡이면 추격자의 시야 밖에서 [H] 키를 눌러 숨을 수 있다.`, "c-system");
    return;
  }

  if (hit.type === "secret_wall") {
    if (deduced.includes("combo_secret")) {
      flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤 숨겨진 방의 문을 열었다.");
      say("SYSTEM", "도출해낸 진실을 바탕으로 벽장 뒤편을 밀자, 숨겨진 방으로 이어지는 비밀 문이 열렸다!", "c-system");
    } else {
      say("강현우", "벽장 뒤에서 서늘한 바람이 새어 나와. 뭔가 숨겨진 공간이 있는 것 같은데... 먼저 관련 단서들을 조합해 비밀을 밝혀야겠어.", "c-hero");
    }
  }
}

function talkToNPC(npc) {
  if (npc.id === "park") {
    const choices = [
      {
        label: "13년 전 1304호 가족 실종 사건에 대해 묻는다",
        action: () => {
          flags.talkedPark = true;
          addLog("경비원 박만식에게 1985년 실종 사건의 정황을 들었다.");
          say("박만식 (경비원)", "1985년 10월 13일 밤이었지... 비명 소리가 들려서 올라갔을 땐 집 안이 텅 비어 있었어. 그때 비상구 앞에서 울고 있던 꼬마 하나만 구조됐지.", "c-npc");
        }
      },
      {
        label: "1985년 사건 당일 출동했던 경찰 기록이나 차량에 대해 묻는다",
        action: () => {
          flags.askedParkCar = true;
          addLog("박만식으로부터 지하 주차장에 방치된 옛 순찰차 이야기를 들었다.");
          say("박만식 (경비원)", "그날 선임 순경 한 분이 실종되면서 함께 온 지원 순찰차가 지하 주차장 구석에 오랫동안 방치됐었소... 유류품 정리가 덜 된 채 그대로 있을지도 모르지.", "c-npc");
        }
      }
    ];

    if (deduced.includes("combo_coverup") || deduced.includes("combo_space")) {
      choices.push({
        label: "[진실 제시] 도면에 없는 13층과 방화문 봉쇄 기록을 추궁한다",
        action: () => {
          flags.parkPartial = true;
          flags.door1304Unlocked = true;
          addLog("박만식이 1985년 그날 밤 방화문을 잠근 1차 은폐 사실을 인정했다.");
          say("박만식 (경비원)", "...결국 알아냈군. 그날 밤 1304호 아버지가 빚과 망상에 미쳐 가족을 가뒀어. 난 무서워서 방화문을 잠그고 신고를 늦췄지. 하지만 그날 밤 현장에 있던 소년이 누구였는지는 나도 입을 다물 수밖에 없었소...", "c-npc");
        }
      });
    }

    if (flags.parkPartial && (deduced.includes("combo_past") || collected.includes("ledger"))) {
      choices.push({
        label: "[기억 공유] 실종된 강 순경과 13년 전 구조된 아들에 대해 묻는다",
        action: () => {
          flags.parkConfessed = true;
          changeSanity(10, "박만식의 완전한 참회와 증언");
          addLog("박만식이 강현우와 그의 아버지(강 순경)에 대한 모든 진실을 고백했다.");
          say("박만식 (경비원)", "자네 얼굴을 보니 이제야 알겠구먼... 그날 밤 강 순경님이 윤서를 구하려 13층에 올라갔다가 실종됐고, 아드님만 홀로 살아남았소. 부디 13층의 비극을 끝내주게!", "c-npc");
        }
      });
    }

    say("박만식 (경비원)", "이 밤중에 무슨 일이십니까? 은하아파트는 곧 철거될 건물입니다. 13층 같은 건 애초에 없어요.", "c-npc", choices);
  } else if (npc.id === "han") {
    const choices = [
      {
        label: "밤마다 위층에서 들린다는 발소리에 대해 묻는다",
        action: () => {
          flags.talkedHan = true;
          addLog("주민 한미정에게 매일 밤 11시 47분마다 들리는 울음소리를 들었다.");
          say("한미정 (주민)", "저는 1204호에 살아요. 그런데 매일 밤 11시 47분만 되면 천장 위... 존재하지도 않는 13층에서 여자아이 울음소리와 노크 소리가 들려요. 그 직전엔 꼭 복도 형광등이 깜빡거리더라고요.", "c-npc");
        }
      },
      {
        label: "13년째 미뤄진 아파트 철거와 1304호 소문에 대해 묻는다",
        action: () => {
          flags.talkedHan = true;
          addLog("한미정으로부터 철거 측량 인부들이 13층에서 실종되었던 이야기를 들었다.");
          say("한미정 (주민)", "재개발 조합 사람들이 철거 측량을 하러 올라갔다가 그날 밤 이후로 자취를 감췄대요. 그래서 다들 이 아파트를 떠나고 저만 남았어요...", "c-npc");
        }
      }
    ];

    if (deduced.includes("combo_yoonseo") || collected.includes("medical")) {
      choices.push({
        label: "[진실 제시] '윤서'라는 아이에 대해 알고 있는지 묻는다",
        action: () => {
          flags.hanTruth = true;
          changeSanity(6, "한미정의 진심 어린 증언");
          addLog("한미정이 윤서의 옛 피아노 선생이었음을 밝히고 진실을 증언했다.");
          say("한미정 (주민)", "윤서 이름을 어떻게 아세요...? 저는 13년 전 윤서의 피아노 선생님이었어요. 윤서는 착하고 여린 아이였어요. 그날 밤 윤서를 구하러 갔던 한 소년도 있었는데...", "c-npc");
        }
      });
    }

    say("한미정 (주민)", "형사님이신가요...? 제발 저 좀 살려주세요. 12층 위에는 아무것도 없어야 하는데, 누군가 계속 문을 두드려요.", "c-npc", choices);
  } else if (npc.id === "yoonseo") {
    const choices = [
      {
        label: "\"너는 누구니? 왜 이 어두운 복도에 혼자 서 있니?\"",
        action: () => {
          flags.metYoonseo = true;
          flags.door1304Unlocked = true;
          addLog("13층 복도의 소녀 윤서와 대화해 1304호 문을 열 수 있게 되었다.");
          say("윤서", "...아저씨도 13번째 방문자인가요? 우리 집 문은 열어 둘게요. 하지만 형광등이 깜빡이면 꼭 숨어야 해요... 망가진 아빠가 오고 있다는 신호니까요.", "c-npc");
        }
      }
    ];

    if (deduced.includes("combo_yoonseo") || deduced.includes("combo_past")) {
      choices.push({
        label: "\"윤서야, 이제 무서워하지 마. 그날 밤의 진실을 모두 기억해냈어.\"",
        action: () => {
          flags.savedYoonseo = true;
          flags.door1304Unlocked = true;
          ghost.warning = false;
          ghost.active = false;
          ghost.escapeRoomCount = 0;
          lightState = "on";
          changeSanity(15, "윤서의 원한 완화");
          addLog("윤서에게 진실을 전하여 그녀의 두려움을 진정시켰다.");
          say("윤서", "...정말 기억해 주신 거예요? 13년 동안 아무도 제 목소리를 들어주지 않았어요. 숨겨진 방의 거울을 봐주세요... 모든 진실이 거기 있어요.", "c-npc");
        }
      });
    } else {
      choices.push({
        label: "\"원혼이라면 당장 사라져라!\" (적대적으로 경고한다)",
        action: () => {
          changeSanity(-18, "13번째 방문자의 분노 촉발");
          startGhostWarning(
            "13층 복도",
            22,
            4,
            "윤서가 겁에 질려 물러서자 복도 끝에서 무거운 발소리와 함께 형광등이 격렬하게 깜빡이기 시작한다! 은신처를 찾거나 구역을 벗어나라 [H]!",
            "형광등이 산산조각 나며 정전되었다! 광기에 잠식된 13번째 방문자가 비명을 지르며 달려온다!"
          );
        }
      });
    }

    say("윤서", "......똑, 똑, 똑. 열두 번까지는 참았는데, 열세 번째 노크가 시작됐어요.", "c-npc", choices);
  }
}

/* -------------------------------------------------------------------------
   12. 형광등 점멸 전조 -> 정전 -> 13번째 방문자 BFS 추격 AI
   ------------------------------------------------------------------------- */
function startGhostWarning(roomName, gx, gy, warningText, chaseText) {
  if (gameEnded) return;
  lightState = "flicker";
  flickerTimer = FLICKER_DURATION;
  flickerSfxCooldown = 0;

  ghost.warning = true;
  ghost.active = false;
  ghost.room = roomName;
  ghost.spawnX = gx;
  ghost.spawnY = gy;
  ghost.chaseText = chaseText;
  ghost.escapeRoomCount = 0;
  ghost.entryDelay = 0;

  // 첫 점멸 이벤트 발생 시 상황 트리거로 튜토리얼 4단계 표시
  if (!flags.tutorialStep4Shown && !flags.tutorialDone) {
    flags.tutorialStep4Shown = true;
    startTutorialStep(4);
  }

  playSfx("flicker");
  addLog(warningText);
  say("SYSTEM", warningText, "c-system");
  updateHUD();
}

function updateLightingAndGhost(dt) {
  if (gameEnded || titleActive || prologueActive || flashbackActive) return;

  // 1. 형광등 점멸 전조 카운트다운 (10초)
  if (lightState === "flicker" && ghost.warning) {
    flickerTimer -= dt;
    flickerSfxCooldown -= dt;
    if (flickerSfxCooldown <= 0) {
      playSfx("flicker");
      const progress = 1 - Math.max(0, flickerTimer / FLICKER_DURATION);
      flickerSfxCooldown = Math.max(0.28, 0.68 - progress * 0.4);
    }

    if (flickerTimer <= 0) {
      ghost.warning = false;
      ghost.active = true;
      ghost.room = currentRoom;
      const safeSpawn = findNearestWalkable(currentRoom, ghost.spawnX, ghost.spawnY);
      ghost.px = safeSpawn.x * TILE;
      ghost.py = safeSpawn.y * TILE;
      ghost.patrolTimer = 0;
      ghost.entryDelay = 0;
      lightState = "out";
      playSfx("ghost");

      if (isHiding) {
        addLog("형광등이 꺼졌지만 제때 몸을 숨긴 덕분에 추격자가 위치를 눈치채지 못했다.");
        say("SYSTEM", "조명이 완전히 꺼지고 어둠 속에서 무거운 발소리가 다가온다... 숨을 죽이고 기다리자.", "c-system");
      } else {
        addLog(ghost.chaseText);
        say("13번째 방문자", ghost.chaseText, "c-ghost");
      }
      updateHUD();
    }
    return;
  }

  // 2. 13번째 방문자 추격/배회 AI (타일 BFS 길찾기 적용)
  if (!ghost.active || ghost.room !== currentRoom) return;

  ghost.heartbeatCooldown -= dt;
  if (ghost.heartbeatCooldown <= 0) {
    playSfx("heartbeat");
    ghost.heartbeatCooldown = 0.95;
  }

  if (ghost.entryDelay > 0) {
    ghost.entryDelay = Math.max(0, ghost.entryDelay - dt);
    return;
  }

  if (isHiding) {
    ghost.patrolTimer += dt;
    ghost.px += Math.sin(animTick * 0.08) * 32 * dt;
    ghost.py += Math.cos(animTick * 0.06) * 22 * dt;
    if (ghost.patrolTimer >= 5.5) {
      ghost.active = false;
      ghost.escapeRoomCount = 0;
      lightState = "on";
      playSfx("light_on");
      changeSanity(4, "은신 성공으로 위기 극복");
      addLog("13번째 방문자가 어둠 속으로 물러나고, 천장 형광등이 다시 켜졌다.");
      say("SYSTEM", "발소리가 멀어지고 지지직거리는 소리와 함께 형광등이 다시 켜졌다!", "c-system");
      updateHUD();
      autoSaveGame();
    }
    return;
  }

  // BFS로 다음 이동 타일 산출 (벽과 가구를 우회해 추격)
  const gxTile = Math.max(1, Math.min(ROOMS[currentRoom].cols - 2, Math.round(ghost.px / TILE)));
  const gyTile = Math.max(1, Math.min(ROOMS[currentRoom].rows - 2, Math.round(ghost.py / TILE)));
  const nextStep = getNextBfsStep(currentRoom, gxTile, gyTile, player.x, player.y);

  const targetX = (nextStep.x === player.x && nextStep.y === player.y) ? player.px : nextStep.x * TILE;
  const targetY = (nextStep.x === player.x && nextStep.y === player.y) ? player.py : nextStep.y * TILE;

  const dx = targetX - ghost.px;
  const dy = targetY - ghost.py;
  const distToStep = Math.hypot(dx, dy);
  const directDist = Math.hypot(player.px - ghost.px, player.py - ghost.py);

  const speedPx = (ghost.speed + (sanity < 40 ? 0.35 : 0)) * TILE;

  if (distToStep > 1) {
    ghost.px += (dx / distToStep) * speedPx * dt;
    ghost.py += (dy / distToStep) * speedPx * dt;
  }

  if (directDist < TILE * 3.0) {
    sanity = Math.max(0, sanity - 5.0 * dt);
    updateHUD();
    if (sanity <= 0) {
      triggerGameOver("정신 붕괴", "13번째 방문자의 광기에 정신을 잠식당한 강현우는 그 자리에서 무너지고 말았다.");
      return;
    }
  }

  if (directDist < TILE * 0.55) {
    triggerGameOver("13층의 제물", "제때 숨거나 따돌리지 못한 강현우는 13번째 방문자의 손아귀에 붙잡혀 13층의 어둠 속으로 끌려갔다.");
  }
}

/* -------------------------------------------------------------------------
   13. 엔딩 분기 (TRUE END / NORMAL END / BAD END / GAME OVER)
   ------------------------------------------------------------------------- */
function triggerFinalMirrorEvent() {
  const hasEnoughClues = collected.length >= 9;
  const hasTruthCombos = deduced.length >= 4 && (deduced.includes("combo_yoonseo") || deduced.includes("combo_past"));
  const hasHumanConnection = flags.savedYoonseo || (flags.parkConfessed && flags.hanTruth) || flags.allPropsExamined;

  const choices = [
    {
      label: "[진실 직면] 거울 속 13년 전 그날 밤의 기억과 마주한다",
      action: () => {
        if (hasEnoughClues && hasTruthCombos && hasHumanConnection) {
          triggerEnding("TRUE");
        } else if (collected.length >= 6) {
          triggerEnding("NORMAL");
        } else {
          triggerEnding("BAD");
        }
      }
    },
    {
      label: "[사건 봉인] 수집한 기록만 챙겨 1304호의 문을 닫고 떠난다",
      action: () => {
        if (collected.length >= 5) {
          triggerEnding("NORMAL");
        } else {
          triggerEnding("BAD");
        }
      }
    },
    {
      label: "[노크 응답] 문밖에서 들리는 익숙한 목소리를 따라 문을 연다",
      action: () => {
        triggerEnding("BAD");
      }
    }
  ];

  say(
    "SYSTEM",
    `방 한가운데 놓인 낡은 거울 속에 1985년 10월 13일의 방이 비치고 있다.\n현재 확보 단서: ${collected.length}/${CLUES.length} · 도출 진실: ${deduced.length}/${COMBINATIONS.length}\n\n등 뒤에서 세 번의 노크 소리가 울린다. 똑. 똑. 똑.\n강현우는 마지막 결정을 내려야 한다.`,
    "c-system",
    choices
  );
}

function triggerEnding(type) {
  gameEnded = true;
  endingType = type;
  ghost.warning = false;
  ghost.active = false;
  lightState = "on";
  recordEndingUnlock(type);
  updateHUD();

  if (type === "TRUE") {
    playSfx("combo");
    addLog("엔딩 달성: [TRUE END - 마지막 방문자와 사라진 가족의 진실]");
    say(
      "TRUE END — 마지막 방문자와 사라진 가족의 진실",
      "거울이 산산조각 나며 봉인되어 있던 13년 전의 기억이 완전히 되살아났다.\n\n" +
      "1985년 10월 13일, 아버지의 광기 속에서 윤서를 구하려다 비상구 앞에 쓰러졌던 소년이 바로 강현우 자신이었다. " +
      "윤서는 악령이 아니라, 자신을 기억해 줄 마지막 방문자를 13년 동안 기다려 온 소녀의 영혼이었다.\n\n" +
      "강현우가 윤서의 이름을 부르며 진실을 세상에 밝히겠다고 맹세하자, 13층의 붉은 어둠이 걷히고 방문자 명부의 마지막 줄이 사라졌다.\n" +
      "다음 날 아침, 은하아파트 1304호의 사건 기록은 정식으로 복원되었고 윤서의 가족은 비로소 안식을 찾았다.",
      "c-clue",
      [
        { label: "처음부터 다시 플레이하기", action: () => resetGame(true) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  } else if (type === "NORMAL") {
    playSfx("door");
    addLog("엔딩 달성: [NORMAL END - 봉인된 미제 사건]");
    say(
      "NORMAL END — 봉인된 미제 사건",
      "강현우는 확보한 물증만을 토대로 1304호 일가족 실종 사건의 수사 보고서를 제출했다.\n\n" +
      "경찰 상부는 사건을 공식 종결 처리했고, 은하아파트 13층 통로는 두꺼운 콘크리트 벽으로 영구 봉인되었다. " +
      "사건은 서류상 해결되었지만, 윤서의 진실과 강현우 자신의 잃어버린 기억은 끝내 밝혀지지 않았다.\n\n" +
      "1년 뒤인 1999년 10월 13일 밤 11시 47분, 강현우의 집 현관문 앞에서 다시 세 번의 노크 소리가 들려왔다.",
      "c-system",
      [
        { label: "진실을 밝히기 위해 다시 도전하기", action: () => resetGame(false) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  } else {
    playSfx("ghost");
    addLog("엔딩 달성: [BAD END - 13번째 방문자]");
    say(
      "BAD END — 13번째 방문자",
      "진실을 깨닫지 못한 채 문을 연 순간, 등 뒤의 복도가 어둠 속으로 사라졌다.\n\n" +
      "방문자 명부의 13번째 칸에 적힌 '강현우'라는 이름이 붉게 물든다. " +
      "시간은 1998년 10월 13일 밤 11시 47분에 영원히 멈춰 버렸다.\n\n" +
      "이제 강현우는 다음 형사가 찾아올 때까지 존재하지 않는 13층 복도를 배회하며, 1304호의 문을 두드리는 13번째 방문자가 되었다.",
      "c-ghost",
      [
        { label: "처음부터 다시 플레이하기", action: () => resetGame(false) },
        { label: "타이틀 화면으로 이동", action: returnToTitle }
      ]
    );
  }
}

function triggerGameOver(title, reason) {
  gameEnded = true;
  endingType = null;
  ghost.warning = false;
  ghost.active = false;
  clearHeldInputs();
  playSfx("ghost");
  updateHUD();
  addLog(`GAME OVER - ${title}`);

  const choices = [];
  if (hasValidSaveData()) {
    choices.push({ label: "마지막 저장 불러오기", action: loadGame });
  }
  choices.push({ label: "새 게임 시작", action: () => resetGame(false) });
  choices.push({ label: "타이틀 화면으로 이동", action: returnToTitle });

  say(
    `GAME OVER — ${title}`,
    `${reason}\n\n은하아파트 13층의 기록에는 또 한 명의 실종자가 추가되었다.`,
    "c-ghost",
    choices
  );
}

/* -------------------------------------------------------------------------
   14. 저장 · 자동 저장 및 불러오기 (소프트락 방지 및 위험 상태 저장 제한)
   ------------------------------------------------------------------------- */
function buildSavePayload() {
  const now = new Date();
  const savedAt = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  return {
    version: GAME_VERSION,
    savedAt,
    currentRoom,
    player: { x: player.x, y: player.y, dir: player.dir },
    sanity,
    stamina,
    collected,
    deduced,
    pickedFieldItems,
    examinedProps,
    inventory,
    flags
  };
}

function autoSaveGame() {
  if (gameEnded || titleActive || ghost.warning || ghost.active) return;
  try {
    const data = buildSavePayload();
    localStorage.setItem("visitorSave", JSON.stringify(data));
  } catch (e) {}
}

function saveGame() {
  if (gameEnded) {
    say("SYSTEM", "이미 엔딩 또는 게임 오버에 도달한 상태입니다.", "c-system");
    return;
  }
  if (ghost.warning || ghost.active) {
    playSfx("bump");
    say("SYSTEM", "형광등이 점멸하거나 추격자가 쫓아오는 위기 상황 중에는 저장할 수 없습니다!", "c-ghost");
    return;
  }
  const data = buildSavePayload();
  localStorage.setItem("visitorSave", JSON.stringify(data));
  playSfx("clue");
  addLog(`현재 수사 진행 상황을 저장했다. (${data.savedAt})`);
  say("SYSTEM", `수사 진행 상황이 브라우저에 안전하게 저장되었습니다. (${data.savedAt})`, "c-system");
}

function loadGame() {
  const raw = localStorage.getItem("visitorSave");
  if (!raw) {
    say("SYSTEM", "저장된 데이터가 없습니다. 새 게임을 시작해 주세요.", "c-system");
    return;
  }
  try {
    const data = JSON.parse(raw);
    const legacyRoomMap = {
      "거실": "1304호 거실",
      "안방": "1304호 안방",
      "아이 방": "1304호 아이 방",
      "숨겨진 방": "1304호 숨겨진 방"
    };
    const loadedRoom = data.currentRoom || data.room || "1층 복도";
    currentRoom = legacyRoomMap[loadedRoom] || (ROOMS[loadedRoom] ? loadedRoom : "1층 복도");

    const rawPlayer = data.player || { x: 4, y: 5, dir: "down" };
    const safePos = findNearestWalkable(currentRoom, rawPlayer.x ?? 4, rawPlayer.y ?? 5);
    player = {
      x: safePos.x,
      y: safePos.y,
      px: safePos.x * TILE,
      py: safePos.y * TILE,
      dir: rawPlayer.dir || "down",
      moving: false,
      walkTimer: 0,
      stepParity: 0
    };
    syncPlayerPixelToGrid();
    snapCamera();

    sanity = typeof data.sanity === "number" ? Math.max(10, Math.min(100, data.sanity)) : 100;
    stamina = typeof data.stamina === "number" ? Math.max(0, Math.min(100, data.stamina)) : 100;
    collected = Array.isArray(data.collected) ? data.collected : [];
    deduced = Array.isArray(data.deduced) ? data.deduced : [];
    pickedFieldItems = Array.isArray(data.pickedFieldItems) ? data.pickedFieldItems : [];
    examinedProps = Array.isArray(data.examinedProps) ? data.examinedProps : [];
    inventory = data.inventory && typeof data.inventory === "object"
      ? { sedative: data.inventory.sedative ?? 1 }
      : { sedative: 1 };
    flags = data.flags || {};

    selectedClues = [];
    activeChoices = [];
    clearHeldInputs();
    isHiding = false;
    ghost.warning = false;
    ghost.active = false;
    ghost.escapeRoomCount = 0;
    ghost.entryDelay = 0;
    lightState = currentRoom === "1304호 숨겨진 방" ? "out" : "on";
    gameEnded = false;
    endingType = null;
    titleActive = false;
    prologueActive = false;
    flashbackActive = false;
    tutorialStep = 0;
    renderTutorialBanner();

    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";

    renderInventoryUI();
    renderClueUI();
    updateHUD();
    addLog("저장된 데이터를 불러왔다.");
    say("SYSTEM", "저장된 수사 기록을 성공적으로 불러왔습니다.", "c-system");
  } catch (e) {
    say("SYSTEM", "저장 데이터를 읽는 중 오류가 발생했습니다.", "c-system");
  }
}

function resetGame(withPrologue = false) {
  ensureDynamicDOM();
  currentRoom = "1층 복도";
  player = {
    x: 4,
    y: 5,
    px: 4 * TILE,
    py: 5 * TILE,
    dir: "down",
    moving: false,
    walkTimer: 0,
    stepParity: 0
  };
  syncPlayerPixelToGrid();
  snapCamera();

  sanity = 100;
  stamina = 100;
  lightState = "on";
  flickerTimer = 0;
  collected = [];
  deduced = [];
  selectedClues = [];
  pickedFieldItems = [];
  examinedProps = [];
  inventory = { sedative: 1 };
  flags = {};
  activeChoices = [];
  clearHeldInputs();
  isHiding = false;
  currentHidingLabel = "";
  updateClockDisplay();
  ghost.warning = false;
  ghost.active = false;
  ghost.escapeRoomCount = 0;
  ghost.entryDelay = 0;
  gameEnded = false;
  endingType = null;
  flashbackActive = false;
  tutorialStep = 0;
  renderTutorialBanner();

  const logEl = document.getElementById("event-log");
  if (logEl) logEl.innerHTML = "";
  renderInventoryUI();
  renderClueUI();
  updateHUD();
  autoSaveGame();
  addLog("1998년 10월 13일 23:47, 은하아파트 수사를 시작했다.");
  say(
    "강현우",
    "여기가 은하아파트 1층 복도인가... 공기가 유난히 차갑고 눅눅해. 주변 단서와 주민들부터 차분히 조사해 보자.",
    "c-hero"
  );

  if (withPrologue) {
    startPrologue();
  }
}

/* -------------------------------------------------------------------------
   15. 16비트 픽셀 아트 렌더링 엔진
   ------------------------------------------------------------------------- */
function drawDetailedFurniture(f) {
  const x = f.x * TILE;
  const y = f.y * TILE;
  const w = f.w * TILE;
  const h = f.h * TILE;

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x + 3, y + h - 2, w - 4, 5);

  ctx.fillStyle = f.color;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 3, y + 3, w - 6, 4);

  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

  if (f.style === "car") {
    ctx.fillStyle = "#1c2633";
    ctx.fillRect(x + 14, y + 8, w - 28, h - 16);
    ctx.fillStyle = "#f2d28b";
    ctx.fillRect(x + w - 7, y + 8, 4, 8);
    ctx.fillRect(x + w - 7, y + h - 16, 4, 8);
  } else if (f.style === "bed") {
    ctx.fillStyle = "#d9d4e0";
    ctx.fillRect(x + 6, y + 8, 18, h - 16);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x + 28, y + 4, 3, h - 8);
  } else if (f.style === "cctv") {
    ctx.fillStyle = (Math.floor(animTick / 15) % 2 === 0) ? "#4f8c7a" : "#386659";
    ctx.fillRect(x + 8, y + 6, 22, 16);
    ctx.fillRect(x + 36, y + 6, 22, 16);
  } else if (f.style === "mirror") {
    ctx.fillStyle = "#9fb3c7";
    ctx.fillRect(x + 6, y + 5, w - 12, h - 10);
    ctx.fillStyle = "rgba(240, 155, 168, 0.35)";
    ctx.fillRect(x + 12, y + 9, 14, 16);
  }

  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText(f.label, x + w / 2 + 1, y + h / 2 + 4);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(f.label, x + w / 2, y + h / 2 + 3);
  ctx.textAlign = "left";
}

function drawHidingSpot(s) {
  const x = s.x * TILE;
  const y = s.y * TILE;
  const urgent = lightState === "flicker" && !isHiding;

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x + 4, y + TILE - 2, TILE - 6, 4);

  ctx.fillStyle = urgent ? "#4d4327" : "#3a4f48";
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
  ctx.strokeStyle = urgent ? "#F2D28B" : "#8FC9FF";
  ctx.lineWidth = urgent ? 2 : 1.2;
  ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);

  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText("숨기[H]", x + 21, y + 24);
  ctx.fillStyle = urgent ? "#F2D28B" : "#8FC9FF";
  ctx.fillText("숨기[H]", x + 20, y + 23);
  ctx.textAlign = "left";
}

function drawPixelHero(px, py, dir, moving, walkTimer, stepParity) {
  let stride = 0;
  let bobY = 0;
  if (moving) {
    const phase = (walkTimer * 8.5) % 1;
    if (phase < 0.5) {
      stride = stepParity === 0 ? -1 : 1;
      bobY = -1;
    } else {
      stride = 0;
      bobY = 0;
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(px + 9, py + 33, 22, 5);

  const hy = py + bobY;

  if (dir === "down" || dir === "up") {
    const leftLegY = stride === -1 ? -2 : (stride === 1 ? 1 : 0);
    const rightLegY = stride === 1 ? -2 : (stride === -1 ? 1 : 0);

    ctx.fillStyle = "#181d2b";
    ctx.fillRect(px + 12, hy + 28 + leftLegY, 6, 7 - Math.max(0, leftLegY));
    ctx.fillRect(px + 22, hy + 28 + rightLegY, 6, 7 - Math.max(0, rightLegY));

    ctx.fillStyle = "#2b4263";
    ctx.fillRect(px + 10, hy + 16, 20, 14);

    ctx.fillStyle = "#233652";
    ctx.fillRect(px + 7, hy + 17 - stride, 3, 10);
    ctx.fillRect(px + 30, hy + 17 + stride, 3, 10);

    if (dir === "down") {
      ctx.fillStyle = "#8FC9FF";
      ctx.fillRect(px + 13, hy + 17, 14, 11);
      ctx.fillStyle = "#1b283d";
      ctx.fillRect(px + 19, hy + 17, 2, 10);

      ctx.fillStyle = "#f2cbb0";
      ctx.fillRect(px + 12, hy + 5, 16, 11);
      ctx.fillStyle = "#191b24";
      ctx.fillRect(px + 11, hy + 3, 18, 4);
      ctx.fillRect(px + 11, hy + 5, 2, 6);
      ctx.fillRect(px + 27, hy + 5, 2, 6);

      ctx.fillStyle = "#0e121c";
      ctx.fillRect(px + 15, hy + 9, 2, 3);
      ctx.fillRect(px + 23, hy + 9, 2, 3);
    } else {
      ctx.fillStyle = "#1f314a";
      ctx.fillRect(px + 19, hy + 18, 2, 11);
      ctx.fillStyle = "#191b24";
      ctx.fillRect(px + 11, hy + 3, 18, 13);
    }
  } else {
    const isLeft = dir === "left";
    const frontFootX = stride * 3;
    const backFootX = -stride * 3;

    ctx.fillStyle = "#121621";
    ctx.fillRect(px + 16 + backFootX, hy + 28, 6, 7);
    ctx.fillStyle = "#1d2333";
    ctx.fillRect(px + 16 + frontFootX, hy + 28, 6, 7);

    ctx.fillStyle = "#2b4263";
    ctx.fillRect(px + 12, hy + 16, 16, 14);
    ctx.fillStyle = "#8FC9FF";
    ctx.fillRect(isLeft ? px + 12 : px + 24, hy + 17, 4, 10);

    ctx.fillStyle = "#22344f";
    ctx.fillRect(px + 17 - stride * 2, hy + 17, 5, 10);

    ctx.fillStyle = "#f2cbb0";
    ctx.fillRect(px + 13, hy + 5, 14, 11);
    ctx.fillStyle = "#191b24";
    ctx.fillRect(px + 12, hy + 3, 16, 4);
    ctx.fillRect(isLeft ? px + 23 : px + 12, hy + 5, 5, 10);

    ctx.fillStyle = "#0e121c";
    ctx.fillRect(isLeft ? px + 15 : px + 23, hy + 9, 2, 3);
  }
}

function drawPixelNPC(npc) {
  const px = npc.x * TILE;
  const py = npc.y * TILE;
  const idleBob = Math.floor(animTick / 28) % 2;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(px + 9, py + 33, 22, 5);

  if (npc.id === "park") {
    ctx.fillStyle = "#1c2624";
    ctx.fillRect(px + 13, py + 29, 5, 6);
    ctx.fillRect(px + 22, py + 29, 5, 6);

    ctx.fillStyle = "#3c5954";
    ctx.fillRect(px + 10, py + 16 + idleBob, 20, 14);
    ctx.fillStyle = "#f2d28b";
    ctx.fillRect(px + 13, py + 19 + idleBob, 4, 2);

    ctx.fillStyle = "#e0b89d";
    ctx.fillRect(px + 12, py + 6 + idleBob, 16, 10);
    ctx.fillStyle = "#263835";
    ctx.fillRect(px + 10, py + 3 + idleBob, 20, 4);
    ctx.fillStyle = "#111";
    ctx.fillRect(px + 15, py + 10 + idleBob, 2, 2);
    ctx.fillRect(px + 23, py + 10 + idleBob, 2, 2);
  } else if (npc.id === "han") {
    ctx.fillStyle = "#241b24";
    ctx.fillRect(px + 13, py + 29, 5, 6);
    ctx.fillRect(px + 22, py + 29, 5, 6);

    ctx.fillStyle = "#6e4b6b";
    ctx.fillRect(px + 10, py + 16 + idleBob, 20, 14);
    ctx.fillStyle = "#2b1d24";
    ctx.fillRect(px + 10, py + 4 + idleBob, 20, 13);
    ctx.fillStyle = "#f2cbb0";
    ctx.fillRect(px + 13, py + 7 + idleBob, 14, 9);
    ctx.fillStyle = "#111";
    ctx.fillRect(px + 15, py + 10 + idleBob, 2, 2);
    ctx.fillRect(px + 23, py + 10 + idleBob, 2, 2);
  } else if (npc.id === "yoonseo") {
    const flicker = 0.75 + Math.sin(animTick * 0.15) * 0.2;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.fillStyle = "#e6ecf5";
    ctx.fillRect(px + 11, py + 17 + idleBob, 18, 15);
    ctx.fillStyle = "#17161c";
    ctx.fillRect(px + 11, py + 5 + idleBob, 18, 14);
    ctx.fillStyle = "#f5e6e8";
    ctx.fillRect(px + 14, py + 8 + idleBob, 12, 8);
    ctx.fillStyle = "#3b1820";
    ctx.fillRect(px + 16, py + 11 + idleBob, 2, 2);
    ctx.fillRect(px + 22, py + 11 + idleBob, 2, 2);
    ctx.restore();
  }

  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText(npc.name, px + 21, py - 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(npc.name, px + 20, py - 3);
  ctx.textAlign = "left";
}

function drawPixelGhost(px, py) {
  const floatY = Math.sin(animTick * 0.2) * 3;
  ctx.save();
  ctx.globalAlpha = ghost.entryDelay > 0 ? 0.55 : 0.94;

  ctx.fillStyle = "rgba(240, 155, 168, 0.28)";
  ctx.beginPath();
  ctx.arc(px + 20, py + 20 + floatY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a0b10";
  ctx.fillRect(px + 9, py + 6 + floatY, 22, 28);
  ctx.fillStyle = "#4a1522";
  ctx.fillRect(px + 11, py + 16 + floatY, 18, 16);

  ctx.fillStyle = "#F09BA8";
  ctx.fillRect(px + 14, py + 11 + floatY, 4, 3);
  ctx.fillRect(px + 22, py + 11 + floatY, 4, 3);

  ctx.restore();
}

function drawInteractionReticle(hit) {
  if (!hit || gameEnded || titleActive || prologueActive || flashbackActive || isHiding) return;
  const x = hit.x * TILE;
  const y = hit.y * TILE;
  const pulse = Math.sin(animTick * 0.18) * 1.5;

  ctx.save();
  ctx.strokeStyle = hit.type === "clue" || hit.type === "mirror" ? "#F2D28B" : "#8FC9FF";
  ctx.lineWidth = 1.6;
  const pad = 4 - pulse * 0.4;
  const len = 7;

  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + len);
  ctx.lineTo(x + pad, y + pad);
  ctx.lineTo(x + pad + len, y + pad);

  ctx.moveTo(x + TILE - pad - len, y + pad);
  ctx.lineTo(x + TILE - pad, y + pad);
  ctx.lineTo(x + TILE - pad, y + pad + len);

  ctx.moveTo(x + pad, y + TILE - pad - len);
  ctx.lineTo(x + pad, y + TILE - pad);
  ctx.lineTo(x + pad + len, y + TILE - pad);

  ctx.moveTo(x + TILE - pad - len, y + TILE - pad);
  ctx.lineTo(x + TILE - pad, y + TILE - pad);
  ctx.lineTo(x + TILE - pad, y + TILE - pad - len);
  ctx.stroke();
  ctx.restore();
}

/* 구역 형광등 조명 오버레이 (정상 점등 / 불규칙 점멸 / 정전 암전) */
function renderRoomLightingOverlay(screenPx, screenPy) {
  if (lightState === "on") {
    currentLightOn = true;
  } else if (lightState === "out") {
    currentLightOn = false;
  } else if (lightState === "flicker") {
    const progress = 1 - Math.max(0, flickerTimer / FLICKER_DURATION);
    const wave = Math.sin(animTick * 0.85) + Math.cos(animTick * 1.93);
    currentLightOn = wave > (-0.45 + progress * 0.95);
  }

  lctx.save();
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);

  if (currentLightOn) {
    const edgeAlpha = currentRoom.includes("13") ? 0.34 : 0.22;
    const roomGrad = lctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 140,
      canvas.width / 2, canvas.height / 2, 420
    );
    roomGrad.addColorStop(0, "rgba(0, 0, 0, 0.04)");
    roomGrad.addColorStop(1, `rgba(6, 7, 14, ${edgeAlpha})`);
    lctx.fillStyle = roomGrad;
    lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    if (lightState === "flicker") {
      lctx.fillStyle = "rgba(210, 230, 255, 0.08)";
      lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
    }
  } else {
    const darkAlpha = lightState === "flicker" ? 0.86 : 0.92;
    lctx.fillStyle = `rgba(4, 5, 11, ${darkAlpha})`;
    lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    lctx.globalCompositeOperation = "destination-out";
    const visRadius = isHiding ? 52 : (sanity < 50 ? 62 : 76);
    const ambGrad = lctx.createRadialGradient(screenPx, screenPy, 14, screenPx, screenPy, visRadius);
    ambGrad.addColorStop(0, "rgba(0,0,0,1)");
    ambGrad.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = ambGrad;
    lctx.beginPath();
    lctx.arc(screenPx, screenPy, visRadius, 0, Math.PI * 2);
    lctx.fill();

    if (ghost.active && ghost.room === currentRoom) {
      const gx = ghost.px + TILE / 2 - Math.round(camera.x);
      const gy = ghost.py + TILE / 2 - Math.round(camera.y);
      const gGrad = lctx.createRadialGradient(gx, gy, 8, gx, gy, 54);
      gGrad.addColorStop(0, "rgba(0,0,0,0.95)");
      gGrad.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = gGrad;
      lctx.beginPath();
      lctx.arc(gx, gy, 54, 0, Math.PI * 2);
      lctx.fill();
    }
  }

  lctx.restore();
  ctx.drawImage(lightCanvas, 0, 0);
}

function renderMinimap() {
  if (!showMinimap || titleActive) return;
  const r = ROOMS[currentRoom];
  if (!r) return;

  const scale = 4;
  const mapW = r.cols * scale;
  const mapH = r.rows * scale;
  const pad = 6;
  const boxW = mapW + pad * 2;
  const boxH = mapH + pad * 2 + 12;
  const bx = canvas.width - boxW - 12;
  const by = 12;

  ctx.save();
  ctx.fillStyle = "rgba(8, 10, 18, 0.82)";
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = lightState === "out" ? "#F09BA8" : "#756e85";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = lightState === "out" ? "#F09BA8" : "#F2D28B";
  ctx.fillText(lightState === "out" ? "BLACKOUT" : "MAP [M]", bx + pad, by + 10);

  const ox = bx + pad;
  const oy = by + 14;

  ctx.fillStyle = "#2b2f42";
  ctx.fillRect(ox, oy, mapW, mapH);
  ctx.strokeStyle = "#5c566e";
  ctx.strokeRect(ox, oy, mapW, mapH);

  ctx.fillStyle = "#4d536b";
  r.furniture.forEach(f => {
    ctx.fillRect(ox + f.x * scale, oy + f.y * scale, f.w * scale, f.h * scale);
  });

  // 은신처 (민트색 표시)
  r.hidingSpots.forEach(s => {
    ctx.fillStyle = "#9ce0b8";
    ctx.fillRect(ox + s.x * scale, oy + s.y * scale, scale, scale);
  });

  r.doors.forEach(d => {
    if (d.secret && !flags.secretOpen) return;
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(ox + d.x * scale, oy + d.y * scale, scale, scale);
  });

  // 정전 중에는 단서·추격자 점 비표시 (어둠의 긴장감 유지)
  if (lightState !== "out") {
    CLUES.filter(c => c.room === currentRoom && !collected.includes(c.id)).forEach(c => {
      ctx.fillStyle = "#ffe680";
      ctx.fillRect(ox + c.x * scale, oy + c.y * scale, scale, scale);
    });

    NPCS.filter(n => n.room === currentRoom).forEach(n => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(ox + n.x * scale, oy + n.y * scale, scale, scale);
    });
  }

  ctx.fillStyle = "#8FC9FF";
  ctx.fillRect(ox + (player.px / TILE) * scale, oy + (player.py / TILE) * scale, scale + 1, scale + 1);

  ctx.restore();
}

function renderGame() {
  animTick++;
  const r = ROOMS[currentRoom];
  if (!r) return;

  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;

  ctx.save();
  ctx.fillStyle = "#06070c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (screenShake > 0) {
    const sx = (Math.random() - 0.5) * screenShake;
    const sy = (Math.random() - 0.5) * screenShake;
    ctx.translate(sx, sy);
    screenShake *= 0.85;
    if (screenShake < 0.3) screenShake = 0;
  }

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  ctx.fillStyle = r.bg;
  ctx.fillRect(0, 0, mapW, mapH);

  for (let y = 1; y < r.rows - 1; y++) {
    for (let x = 1; x < r.cols - 1; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? r.floorA : r.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.fillStyle = r.wall;
  ctx.fillRect(0, 0, mapW, TILE);
  ctx.fillRect(0, (r.rows - 1) * TILE, mapW, TILE);
  ctx.fillRect(0, 0, TILE, mapH);
  ctx.fillRect((r.cols - 1) * TILE, 0, TILE, mapH);

  r.doors.forEach(d => {
    if (d.secret && !flags.secretOpen) return;
    ctx.fillStyle = d.secret ? "#8c4a58" : "#8f6b4a";
    ctx.fillRect(d.x * TILE + 4, d.y * TILE + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = "#F2D28B";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(d.x * TILE + 4, d.y * TILE + 4, TILE - 8, TILE - 8);

    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText(d.label, d.x * TILE + 21, d.y * TILE + 23);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(d.label, d.x * TILE + 20, d.y * TILE + 22);
    ctx.textAlign = "left";
  });

  PROPS.filter(p => p.room === currentRoom).forEach(p => {
    const done = examinedProps.includes(p.id);
    ctx.fillStyle = done ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.78)";
    ctx.fillRect(p.x * TILE + 16, p.y * TILE + 16, 8, 8);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(p.x * TILE + 16, p.y * TILE + 16, 8, 8);
  });

  FIELD_ITEMS.filter(it => it.room === currentRoom && !pickedFieldItems.includes(it.id)).forEach(it => {
    ctx.fillStyle = "#8FC9FF";
    ctx.fillRect(it.x * TILE + 13, it.y * TILE + 13, 14, 14);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(it.x * TILE + 13, it.y * TILE + 13, 14, 14);
    ctx.fillStyle = "#000";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", it.x * TILE + 20, it.y * TILE + 24);
    ctx.textAlign = "left";
  });

  CLUES.filter(c => c.room === currentRoom && !collected.includes(c.id)).forEach(c => {
    const pulse = Math.sin(animTick * 0.14) * 2;
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(c.x * TILE + 12 - pulse / 2, c.y * TILE + 12 - pulse / 2, 16 + pulse, 16 + pulse);
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", c.x * TILE + 20, c.y * TILE + 24);
    ctx.textAlign = "left";
  });

  const renderables = [];

  r.furniture.forEach(f => {
    renderables.push({
      sortY: (f.y + f.h) * TILE,
      draw: () => drawDetailedFurniture(f)
    });
  });

  r.hidingSpots.forEach(s => {
    renderables.push({
      sortY: (s.y + 1) * TILE,
      draw: () => drawHidingSpot(s)
    });
  });

  NPCS.filter(n => n.room === currentRoom).forEach(n => {
    renderables.push({
      sortY: (n.y + 1) * TILE,
      draw: () => drawPixelNPC(n)
    });
  });

  renderables.push({
    sortY: player.py + TILE,
    draw: () => {
      if (!isHiding) {
        drawPixelHero(player.px, player.py, player.dir, player.moving, player.walkTimer, player.stepParity);
      } else {
        ctx.fillStyle = "#9ce0b8";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("은신 중...", player.px - 2, player.py - 4);
      }
    }
  });

  if (ghost.active && ghost.room === currentRoom) {
    renderables.push({
      sortY: ghost.py + TILE,
      draw: () => drawPixelGhost(ghost.px, ghost.py)
    });
  }

  renderables.sort((a, b) => a.sortY - b.sortY);
  renderables.forEach(item => item.draw());

  drawInteractionReticle(getBestInteractTarget());

  ctx.restore();

  const screenPx = player.px + TILE / 2 - Math.round(camera.x);
  const screenPy = player.py + TILE / 2 - Math.round(camera.y);
  renderRoomLightingOverlay(screenPx, screenPy);
  renderMinimap();

  if (sanity < 45) {
    const alpha = ((45 - sanity) / 45) * 0.32 + Math.sin(animTick * 0.25) * 0.05;
    ctx.fillStyle = `rgba(160, 20, 45, ${Math.max(0.05, alpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#000";
  ctx.fillText("은하아파트 · " + currentRoom, 17, 26);
  ctx.fillStyle = "#F2D28B";
  ctx.fillText("은하아파트 · " + currentRoom, 16, 25);

  if (gameEnded && endingType) {
    ctx.fillStyle = "rgba(8, 9, 15, 0.68)";
    ctx.fillRect(120, 125, 400, 110);
    ctx.strokeStyle = endingType === "BAD" ? "#F09BA8" : "#F2D28B";
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 125, 400, 110);

    ctx.textAlign = "center";
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = endingType === "BAD" ? "#F09BA8" : "#F2D28B";
    ctx.fillText(`${endingType} ENDING`, 320, 172);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    const sub = endingType === "TRUE"
      ? "마지막 방문자와 사라진 가족의 진실"
      : (endingType === "NORMAL" ? "봉인된 미제 사건" : "13번째 방문자");
    ctx.fillText(sub, 320, 204);
    ctx.textAlign = "left";
  }

  ctx.restore();
}

/* -------------------------------------------------------------------------
   16. 메인 게임 루프 및 물리 키 코드(e.code) 기반 키보드 입력
   ------------------------------------------------------------------------- */
let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (!gameEnded && !titleActive && !prologueActive && !flashbackActive) {
    updatePlayerMovement(dt);
    updateCamera(dt);

    // 정전/암전 상태에서는 공포감으로 정신력이 서서히 감소
    if (lightState === "out" && !isHiding) {
      sanity = Math.max(0, sanity - 1.1 * dt);
      if (sanity <= 0) {
        triggerGameOver("어둠 속의 공황", "칠흑 같은 정전 속에서 버티지 못한 강현우는 끝내 정신을 잃고 말았다.");
      }
    }

    updateClockDisplay();
    updateLightingAndGhost(dt);
    updateHUD();
  }

  renderGame();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", e => {
  const code = e.code;

  // 1. 프롤로그 오버레이 조작
  if (prologueActive) {
    if (["Space", "Enter", "KeyE", "Escape"].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (code === "Escape") finishPrologue();
    else if (code === "Space" || code === "Enter" || code === "KeyE") advancePrologue();
    return;
  }

  // 2. 기억 회상 컷신 오버레이 조작
  if (flashbackActive) {
    if (["Space", "Enter", "KeyE", "Escape"].includes(code)) e.preventDefault();
    if (e.repeat) return;
    if (code === "Space" || code === "Enter" || code === "KeyE" || code === "Escape") closeMemoryFlashback();
    return;
  }

  // 3. 대화 선택지가 활성화된 상태에서는 이동/조사를 잠그고 숫자키(1~9)로만 선택
  if (activeChoices.length > 0 && !titleActive) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    if (code.startsWith("Digit")) {
      const idx = parseInt(code.replace("Digit", ""), 10) - 1;
      if (activeChoices[idx]) {
        e.preventDefault();
        const chosen = activeChoices[idx];
        activeChoices = [];
        const chBox = document.getElementById("choices");
        if (chBox) chBox.innerHTML = "";
        chosen.action();
      }
    }
    return;
  }

  // 4. 일반 탐색 상태 — 물리 키 코드(e.code)로 한글 IME 상태에서도 즉시 반응
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
    e.preventDefault();
  }
  keys[code] = true;

  if (e.repeat || titleActive) return;
  if (code === "KeyE" || code === "Space") interact();
  else if (code === "KeyH") toggleHide();
  else if (code === "KeyM") toggleMinimap();
  else if (code === "KeyC") combineSelectedClues();
  else if (code === "KeyI") openDeductionSummary();
  else if (code === "KeyQ") useConsumable("sedative");
});

document.addEventListener("keyup", e => {
  keys[e.code] = false;
});

window.addEventListener("blur", () => {
  clearHeldInputs();
});

ensureDynamicDOM();
snapCamera();
refreshTitleScreen();
renderInventoryUI();
renderClueUI();
updateClockDisplay();
updateHUD();
requestAnimationFrame(gameLoop);
