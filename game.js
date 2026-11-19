/* =========================================================================
   《13번째 방문자》 v1.2.0 - 한국형 16비트 픽셀 공포 추리 RPG
   (프롤로그 · 순차 튜토리얼 · 포트레이트 일러스트 · 키워드 강조 · 은신/도주 밸런스)
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. 레트로 Web Audio 사운드 & 오컬트 앰비언트 BGM 시스템
   ------------------------------------------------------------------------- */
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
  else if (kind === "bump") playTone(82, "square", 0.04, 0.02, 60);
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
   2. 프롤로그(도입부) & 순차 튜토리얼 데이터
   ------------------------------------------------------------------------- */
const PROLOGUE_SCENES = [
  {
    chapter: "PROLOGUE 01 · 1985년 10월 13일 23:47",
    title: "도면에 존재하지 않는 층",
    art: "apt_night",
    text: "1985년 10월 13일 밤 11시 47분.\n서울 외곽의 노후 아파트 단지 [[gold:은하아파트]]에서 일가족 네 명이 흔적도 없이 사라졌다.\n준공 도면상 건물은 [[gold:12층]]까지만 존재했지만, 생존자의 증언 속 사건 현장은 [[red:13층 1304호]]였다."
  },
  {
    chapter: "PROLOGUE 02 · 봉인된 기억",
    title: "유일한 생존자",
    art: "corridor_13",
    text: "그날 밤 현장에 출동했던 순경은 실종되었고, 비상구 앞에 쓰러져 있던 열다섯 살 소년만이 홀로 구조되었다.\n극심한 충격으로 그날의 기억을 잃은 소년은 세월이 흘러 신입 형사 [[blue:강현우]]가 되었다."
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
    text: "기시감에 이끌려 홀로 아파트를 찾은 [[blue:강현우]].\n현관문이 닫히는 소리와 함께 로비의 시계가 [[gold:23:47]]에서 멈춰 섰다.\n이제 제한 시간 없이 단서를 모으고 조합해, [[red:13번째 방문자]]의 진실을 밝혀야 한다."
  }
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "튜토리얼 1/4 · 이동 및 전력 질주",
    text: "[[blue:방향키(↑↓←→)]] 또는 [[blue:WASD]]로 이동하고, [[blue:Shift]] 키를 누른 채 이동하면 전력 질주합니다.\n먼저 복도를 한 걸음 이동해 보세요. (또는 아래 [다음 단계] 클릭)"
  },
  {
    step: 2,
    title: "튜토리얼 2/4 · 주변 단서 및 인물 조사",
    text: "반짝이는 노란색 [[gold:[!]]] 표식이나 흰색 소품, 주민 앞에서 [[blue:E]] 또는 [[blue:Space]] 키를 누르면 조사 및 대화가 진행됩니다.\n주변 사물을 한 번 조사해 보세요."
  },
  {
    step: 3,
    title: "튜토리얼 3/4 · 수사 수첩 단서 조합",
    text: "수집한 단서들은 우측 [[gold:수사 수첩]]에 기록됩니다.\n각 단서 아래에 적힌 [[mint:연관 단서 힌트]]를 참고해 단서 2개를 클릭한 뒤 [[blue:[단서 조합 (C)]]]을 누르면 새로운 진실이 해금됩니다."
  },
  {
    step: 4,
    title: "튜토리얼 4/4 · 형광등 점멸과 은신 · 구역 이탈",
    text: "천장 형광등이 [[red:불규칙하게 깜빡이면(10초 유예)]] 원혼이 나타난다는 전조입니다.\n가까운 캐비닛·장롱에서 [[blue:[H]]] 키로 [[mint:은신]]하거나, 은신처가 없는 방이라면 [[red:문을 통해 다른 구역으로 빠르게 벗어나세요!]]"
  }
];

/* -------------------------------------------------------------------------
   3. 게임 데이터 (단서 12종 + 조합 힌트, 증거 조합 7종, 필드 아이템 5종, 소품 8종)
   ------------------------------------------------------------------------- */
const CLUES = [
  {
    id: "newspaper",
    name: "1998년 10월자 낡은 신문",
    room: "1층 복도",
    x: 3, y: 3,
    description: "우편함 옆에 구겨진 조간신문.\n'IMF 한파 속 재개발 표류... 은하아파트 철거 또 연기. 1985년 1304호 일가족 실종 미제 사건 이후 괴담 잇따라.'",
    importance: "은하아파트 철거가 13년째 미뤄진 이유는 1985년 실종 사건과 괴담 때문이다.",
    comboHint: "1304호 내부의 최근 생활 흔적(관리비 고지서 등)과 조합해 보자."
  },
  {
    id: "blueprint",
    name: "1985년 준공 도면",
    room: "경비실",
    x: 11, y: 5,
    description: "은하아파트의 공식 건축 도면.\n지하 1층부터 지상 12층까지만 설계되어 있다. 13층은 도면 어디에도 존재하지 않는다.",
    importance: "은하아파트에는 원래 13층이 없다.",
    comboHint: "경비실의 '근무일지' 또는 13층 복도의 '벽면 긁힌 자국'과 조합해 보자."
  },
  {
    id: "guard_log",
    name: "1985년 경비 근무일지",
    room: "경비실",
    x: 3, y: 5,
    description: "박만식의 필체로 적힌 낡은 근무일지.\n'1985.10.13 23:47 - 13층 비상 방화문 시건 조치. 상부 지시로 13층 출입 기록 전체 파기.'",
    importance: "1985년 10월 13일 밤, 경비원이 13층 방화문을 밖에서 잠갔다.",
    comboHint: "경비실의 '1985년 준공 도면'과 조합해 보자."
  },
  {
    id: "car_memo",
    name: "차량 내 수첩 조각",
    room: "지하 주차장",
    x: 5, y: 6,
    description: "먼지 쌓인 구형 순찰 기록 수첩.\n'1985년 10월 13일, 1304호 일가족 실종. 당시 현장에 휘말렸던 순경의 아들 강현우(당시 15세)가 13층 비상구 앞에서 구조됨.'",
    importance: "13년 전 현장에서 구조된 아이의 이름이 강현우다.",
    comboHint: "1304호 숨겨진 방에서 찾을 수 있는 '방문자 명부'와 조합해 보자."
  },
  {
    id: "tally",
    name: "벽면의 긁힌 자국",
    room: "13층 복도",
    x: 9, y: 2,
    description: "콘크리트 벽을 손톱으로 긁어 남긴 열두 줄의 표시.\n그 아래 피로 쓴 듯한 글씨가 희미하다. '윤서를 지켜야 해. 문을 열지 마.'",
    importance: "누군가 13층 복도에서 필사적으로 버티며 기록을 남겼다.",
    comboHint: "경비실의 '1985년 준공 도면'과 조합해 보자."
  },
  {
    id: "photo",
    name: "가족사진",
    room: "1304호 거실",
    x: 13, y: 2,
    description: "사진 속에는 네 명의 가족이 서 있다.\n그런데 사진 뒤편 어두운 베란다 창문에 낯선 남자의 얼굴이 비쳐 있다.",
    importance: "실종 당일 촬영된 사진에 정체불명의 인물이 찍혀 있다.",
    comboHint: "1304호 안방에서 발견되는 '병원 기록'과 조합해 보자."
  },
  {
    id: "letter",
    name: "찢어진 편지",
    room: "1304호 거실",
    x: 4, y: 6,
    description: "'그 아이는 우리 아이가 아니야. 13층에서 들리는 소리를 더는 무시할 수 없어. 오늘 밤 아이를 벽장 뒤에 숨겨야 해.'",
    importance: "어머니가 10월 13일 밤 아이를 숨기려 했던 흔적이다.",
    comboHint: "1304호 아이 방의 '아이의 일기'와 조합해 비밀 통로를 열자."
  },
  {
    id: "bill",
    name: "1998년 관리비 고지서",
    room: "1304호 거실",
    x: 11, y: 4,
    description: "1304호 앞으로 발행된 1998년 10월분 관리비 명세서.\n13년째 거주자가 없는데도 매일 밤 11시 47분경 급격한 전기·수도 사용량이 기록되어 있다.",
    importance: "1304호는 13년째 매달 밤마다 누군가 생활한 흔적이 찍히고 있다.",
    comboHint: "1층 복도 우편함 옆의 '1998년 10월자 낡은 신문'과 조합해 보자."
  },
  {
    id: "diary",
    name: "아이의 일기",
    room: "1304호 아이 방",
    x: 7, y: 3,
    description: "10월 13일.\n오늘도 13번째 사람이 문을 두드렸다.\n엄마는 그 사람이 아빠라고 말했다.\n하지만 아빠는 이미 죽었다.",
    importance: "13번째 방문자의 존재와 아버지의 비밀이 적혀 있다.",
    comboHint: "1304호 거실의 '찢어진 편지'와 조합해 벽장 뒤 비밀을 풀자."
  },
  {
    id: "medical",
    name: "병원 기록",
    room: "1304호 안방",
    x: 11, y: 5,
    description: "환자명: 윤서.\n진단: 심한 해리 증상 및 반복적인 환청.\n보호자 서명란에는 실종된 아버지의 이름이 적혀 있다.",
    importance: "윤서는 실종된 가족의 딸이며 사건의 핵심 인물이다.",
    comboHint: "1304호 거실의 '가족사진'과 조합해 보자."
  },
  {
    id: "recording",
    name: "녹음기",
    room: "1304호 숨겨진 방",
    x: 6, y: 4,
    description: "녹음 재생...\n'문을 열지 마. 내가 돌아오면 절대 문을 열면 안 돼. 그건 내가 아니야.'\n그 뒤로 세 번의 무거운 노크 소리가 들린다.",
    importance: "노크 소리에 속아 문을 열면 안 된다는 경고다.",
    comboHint: "같은 방에 있는 '방문자 명부'와 조합해 보자."
  },
  {
    id: "ledger",
    name: "방문자 명부",
    room: "1304호 숨겨진 방",
    x: 11, y: 6,
    description: "은하아파트 방문자 기록.\n1998년 10월 13일.\n방문자 1번부터 12번까지 이름이 지워져 있고, 마지막 13번째 줄에는 '강현우'라고 적혀 있다.",
    importance: "강현우 자신의 이름이 13번째 방문자로 기록되어 있다.",
    comboHint: "지하 주차장의 '차량 내 수첩 조각' 또는 숨겨진 방의 '녹음기'와 조합해 보자."
  }
];

const COMBINATIONS = [
  {
    id: "combo_space",
    pair: ["blueprint", "tally"],
    title: "[진실 1] 도면에 없는 13층의 비밀",
    summary: "은하아파트는 12층까지만 존재한다. 13층은 1985년 10월 13일의 참극과 원념이 응결되어 만들어진 비현실적 이계(異界)다."
  },
  {
    id: "combo_coverup",
    pair: ["blueprint", "guard_log"],
    title: "[진실 2] 은폐된 방화문 봉쇄",
    summary: "1985년 그날 밤, 경비원 박만식은 참극을 목격하고도 13층 방화문을 밖에서 잠근 채 기록을 파기했다."
  },
  {
    id: "combo_secret",
    pair: ["letter", "diary"],
    title: "[진실 3] 아이 방 벽장 뒤 밀실",
    summary: "13번째 방문자의 위협을 느낀 어머니는 윤서를 보호하기 위해 아이 방 벽장 뒤에 비밀 방을 만들어 숨겼다.",
    onUnlock: () => {
      if (!flags.secretOpen) {
        flags.secretOpen = true;
        addLog("증거 조합으로 아이 방 벽장 뒤 비밀 통로의 단서를 찾아냈다!");
      }
    }
  },
  {
    id: "combo_yoonseo",
    pair: ["photo", "medical"],
    title: "[진실 4] 소녀 윤서의 정체",
    summary: "윤서는 악령이 아니라 13년 전 가족의 비극 속에서 홀로 살아남아 구조를 기다리다 13층의 시간에 갇혀버린 소녀다."
  },
  {
    id: "combo_past",
    pair: ["car_memo", "ledger"],
    title: "[진실 5] 강현우의 잃어버린 기억",
    summary: "13년 전 사건 현장에서 구조되었던 15세 소년이 바로 강현우 자신이다. 트라우마로 기억을 잃은 채 13번째 방문자로 되돌아온 것이다."
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

/* 필드에서 획득 가능한 소비 아이템 (신경안정제 중심) */
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
    id: "sed_guard",
    type: "sedative",
    name: "경비실 신경안정제",
    room: "경비실",
    x: 9, y: 2,
    desc: "경비실 벽면 구급함에서 찾은 처방 안정제. 복용 시 정신력을 30 회복한다."
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
  },
  {
    id: "sed_child",
    type: "sedative",
    name: "책상 서랍 안정제",
    room: "1304호 아이 방",
    x: 10, y: 4,
    desc: "아이 방 책상 서랍에 들어 있던 비상약. 복용 시 정신력을 30 회복한다."
  }
];

/* 1998년 한국 아파트 환경 소품 */
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
    text: "인형 옆에 놓인 쪽지에 비뚤비뚤한 글씨가 적혀 있다. '아저씨, 벽장 뒤로 오면 안 돼요... 아빠가 거기 있어요...'",
    sanityDelta: -4,
    sanityReason: "아이 방 인형에 남겨진 섬뜩한 메모"
  }
];

/* 구역별 가변 맵 크기 (cols, rows) & 전략적으로 축소된 은신처 배치 (구역 이탈 유도) */
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
   4. 게임 상태 변수 (형광등 점멸 & 은신 · 구역 이탈 시스템 포함)
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

let isHiding = false;
let currentHidingLabel = "";
let gameEnded = false;
let endingType = null;
let elevatorFloor = "1층 복도";
let titleActive = true;
let showMinimap = true;

// 프롤로그 & 튜토리얼 상태
let prologueActive = false;
let prologueIndex = 0;
let tutorialStep = 0; // 0 = 비활성, 1~4 = 진행 중 단계

// 원혼 출현 전조 & 추격 AI 상태
let ghost = {
  warning: false,
  active: false,
  room: "",
  spawnX: 0,
  spawnY: 0,
  px: 0,
  py: 0,
  speed: 2.25,
  patrolTimer: 0,
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
   5. 동적 UI 스타일 주입 · 키워드 강조 · 16비트 대화창 포트레이트 일러스트
   ------------------------------------------------------------------------- */
function injectEnhancedStylesAndDOM() {
  if (!document.getElementById("visitor-v12-style")) {
    const style = document.createElement("style");
    style.id = "visitor-v12-style";
    style.textContent = `
      .hl-gold { color: #F2D28B; font-weight: 700; }
      .hl-blue { color: #8FC9FF; font-weight: 700; }
      .hl-red  { color: #F09BA8; font-weight: 700; }
      .hl-mint { color: #9ce0b8; font-weight: 700; }

      #dialogue-visual-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 6px;
      }
      #portrait-frame {
        flex: 0 0 76px;
        width: 76px;
        background: #0d0f18;
        border: 1.5px solid #59536b;
        border-radius: 4px;
        padding: 3px;
        box-shadow: inset 0 0 10px rgba(0,0,0,0.85);
        text-align: center;
      }
      #portrait-canvas {
        display: block;
        width: 68px;
        height: 68px;
        margin: 0 auto;
        image-rendering: pixelated;
        background: #141724;
      }
      #portrait-role {
        margin-top: 3px;
        font-size: 9px;
        line-height: 1.2;
        color: #b8bdd1;
        letter-spacing: -0.3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #dialogue-text-col {
        flex: 1;
        min-width: 0;
      }

      /* 프롤로그 시네마틱 오버레이 */
      #prologue-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(5, 6, 12, 0.94);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }
      .prologue-card {
        width: 100%;
        max-width: 640px;
        background: #121420;
        border: 2px solid #6b627d;
        border-radius: 6px;
        padding: 20px 22px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.85);
        color: #e6e8f2;
      }
      .prologue-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #F2D28B;
        margin-bottom: 8px;
        border-bottom: 1px solid #2b2f42;
        padding-bottom: 6px;
      }
      .prologue-title {
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        margin-bottom: 12px;
      }
      .prologue-body-row {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 16px;
      }
      #prologue-art-canvas {
        flex: 0 0 160px;
        width: 160px;
        height: 110px;
        border: 1.5px solid #4c465c;
        background: #0a0c14;
        image-rendering: pixelated;
      }
      #prologue-text {
        flex: 1;
        font-size: 13.5px;
        line-height: 1.72;
        color: #dfe3f0;
      }
      .prologue-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .prologue-btn {
        background: #23283b;
        color: #e6e8f2;
        border: 1px solid #5c6482;
        padding: 7px 14px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .prologue-btn:hover {
        background: #2f3650;
      }
      .prologue-btn-primary {
        background: #33476b;
        border-color: #8FC9FF;
        color: #ffffff;
        font-weight: 700;
      }
      .prologue-btn-primary:hover {
        background: #405985;
      }

      /* 튜토리얼 배너 */
      #tutorial-banner {
        display: none;
        margin-top: 8px;
        padding: 9px 11px;
        background: rgba(20, 29, 46, 0.92);
        border: 1px solid #8FC9FF;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.55;
        color: #e8eefc;
      }
      .tutorial-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        color: #8FC9FF;
        font-weight: 700;
        font-size: 12px;
      }
      .tutorial-controls {
        margin-top: 6px;
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
      .tut-btn {
        background: #1c263b;
        color: #cfe3ff;
        border: 1px solid #5976a8;
        border-radius: 3px;
        padding: 3px 9px;
        font-size: 11px;
        cursor: pointer;
      }
      .tut-btn:hover {
        background: #2a3957;
      }
    `;
    document.head.appendChild(style);
  }

  // 대화창에 16비트 픽셀 포트레이트 박스 및 튜토리얼 배너 삽입
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

  // 프롤로그 오버레이 DOM 생성
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
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatHighlightedDialogue(rawText) {
  let html = escapeHtml(rawText);

  // 명시적 태그([[gold:...]], [[blue:...]], [[red:...]], [[mint:...]]) 우선 치환
  html = html.replace(/\[\[(gold|blue|red|mint):([^\]]+)\]\]/g, (_, cls, inner) => {
    return `<span class="hl-${cls}">${inner}</span>`;
  });

  // 자동 핵심 키워드 강조 규칙 (태그 내부 속성값을 건드리지 않도록 텍스트 구간만 치환)
  const rules = [
    {
      cls: "hl-gold",
      regex: /(1985년 10월 13일|1998년 10월 13일|1999년 10월 13일|11시 47분|23:47|1304호|1303호|1302호|1204호|13층|열세 번째|13번째 방문자|방문자 명부|준공 도면|근무일지|녹음기|가족사진|병원 기록|아이의 일기|찢어진 편지|관리비 고지서|연관 단서 힌트)/g
    },
    {
      cls: "hl-blue",
      regex: /(강현우|윤서|박만식|한미정|벽장 뒤|숨겨진 방|낡은 거울|거울|\[H\]|\[E\]|\[C\]|\[M\]|\[1\])/g
    },
    {
      cls: "hl-red",
      regex: /(형광등이 격렬하게 깜빡|형광등이 불규칙하게 점멸|형광등이 심하게 깜빡|형광등이 깜빡이면|형광등이 깜빡거리면|문을 열지 마|정전|원혼|노크 소리|몸을 숨길 곳이 없다|실종|피로 쓴|죽었다|GAME OVER|BAD END)/g
    },
    {
      cls: "hl-mint",
      regex: /(은신|숨기|캐비닛|대형 장롱|장롱|콘크리트 기둥|기둥|신경안정제|안전 구역|TRUE END)/g
    }
  ];

  // HTML 태그(<span ...>...</span>)를 분리해 일반 텍스트 조각에만 규칙 적용
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
function renderSpeakerPortrait(speakerName, speakerClass) {
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
  } else if (name.includes("원혼") || name.includes("BAD END") || name.includes("GAME OVER")) {
    kind = "ghost";
    roleLabel = "13층의 원념";
  } else if (name.includes("단서") || name.includes("수첩") || name.includes("TRUE END")) {
    kind = "clue";
    roleLabel = "수사 기록";
  }

  pRole.textContent = roleLabel;

  // 배경 그라데이션
  const bg = pctx.createLinearGradient(0, 0, 0, H);
  if (kind === "hero") {
    bg.addColorStop(0, "#182438");
    bg.addColorStop(1, "#0d131f");
  } else if (kind === "park") {
    bg.addColorStop(0, "#1c2b28");
    bg.addColorStop(1, "#0f1715");
  } else if (kind === "han") {
    bg.addColorStop(0, "#2b1d2c");
    bg.addColorStop(1, "#140d15");
  } else if (kind === "yoonseo") {
    bg.addColorStop(0, "#262333");
    bg.addColorStop(1, "#110f17");
  } else if (kind === "ghost") {
    bg.addColorStop(0, "#3b1019");
    bg.addColorStop(1, "#140508");
  } else if (kind === "clue") {
    bg.addColorStop(0, "#2e2618");
    bg.addColorStop(1, "#14110b");
  } else {
    bg.addColorStop(0, "#1b2030");
    bg.addColorStop(1, "#0d1018");
  }
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, W, H);

  // 캐릭터별 16비트 픽셀 초상화 그리기
  if (kind === "hero") {
    // 트렌치코트 & 셔츠 넥타이
    pctx.fillStyle = "#263b59";
    pctx.fillRect(12, 46, 44, 22);
    pctx.fillStyle = "#1b2a40";
    pctx.fillRect(26, 46, 16, 22);
    pctx.fillStyle = "#8FC9FF";
    pctx.fillRect(29, 47, 10, 14);
    pctx.fillStyle = "#141c2b";
    pctx.fillRect(33, 49, 2, 14);
    // 목 & 얼굴
    pctx.fillStyle = "#d9ad91";
    pctx.fillRect(29, 40, 10, 7);
    pctx.fillStyle = "#f2cbb0";
    pctx.fillRect(21, 18, 26, 24);
    // 머리카락
    pctx.fillStyle = "#161821";
    pctx.fillRect(19, 11, 30, 10);
    pctx.fillRect(19, 18, 4, 15);
    pctx.fillRect(45, 18, 4, 15);
    pctx.fillRect(24, 19, 4, 3);
    pctx.fillRect(36, 19, 5, 3);
    // 눈썹 & 눈
    pctx.fillStyle = "#1a1d26";
    pctx.fillRect(24, 26, 6, 2);
    pctx.fillRect(38, 26, 6, 2);
    pctx.fillStyle = "#0e121c";
    pctx.fillRect(26, 29, 3, 4);
    pctx.fillRect(39, 29, 3, 4);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(26, 29, 1, 1);
    pctx.fillRect(39, 29, 1, 1);
    // 입
    pctx.fillStyle = "#b8826c";
    pctx.fillRect(31, 37, 6, 2);
  } else if (kind === "park") {
    // 경비원 제복 & 견장
    pctx.fillStyle = "#36524d";
    pctx.fillRect(12, 47, 44, 21);
    pctx.fillStyle = "#f2d28b";
    pctx.fillRect(15, 48, 8, 3);
    pctx.fillRect(45, 48, 8, 3);
    pctx.fillStyle = "#d6e0de";
    pctx.fillRect(30, 47, 8, 12);
    // 얼굴
    pctx.fillStyle = "#cfa184";
    pctx.fillRect(29, 41, 10, 6);
    pctx.fillStyle = "#e0b89d";
    pctx.fillRect(21, 20, 26, 22);
    // 경비모
    pctx.fillStyle = "#223330";
    pctx.fillRect(18, 11, 32, 9);
    pctx.fillStyle = "#131c1a";
    pctx.fillRect(17, 19, 34, 3);
    pctx.fillStyle = "#F2D28B";
    pctx.fillRect(32, 14, 4, 4);
    // 눈 & 콧수염
    pctx.fillStyle = "#141414";
    pctx.fillRect(25, 28, 3, 3);
    pctx.fillRect(40, 28, 3, 3);
    pctx.fillStyle = "#4a4644";
    pctx.fillRect(28, 35, 12, 2);
  } else if (kind === "han") {
    // 보라빛 가디건
    pctx.fillStyle = "#6e4b6b";
    pctx.fillRect(13, 47, 42, 21);
    pctx.fillStyle = "#e8dfe6";
    pctx.fillRect(28, 47, 12, 14);
    // 얼굴 & 단발머리
    pctx.fillStyle = "#f2cbb0";
    pctx.fillRect(22, 20, 24, 22);
    pctx.fillStyle = "#291b23";
    pctx.fillRect(18, 12, 32, 10);
    pctx.fillRect(18, 19, 5, 24);
    pctx.fillRect(45, 19, 5, 24);
    // 불안한 눈빛
    pctx.fillStyle = "#181216";
    pctx.fillRect(25, 28, 4, 4);
    pctx.fillRect(39, 28, 4, 4);
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(26, 28, 1, 1);
    pctx.fillRect(40, 28, 1, 1);
    pctx.fillStyle = "#c4847a";
    pctx.fillRect(31, 37, 6, 2);
  } else if (kind === "yoonseo") {
    // 소녀 윤서 (창백한 안색 & 흰 원피스)
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
    // 슬픈 어두운 눈
    pctx.fillStyle = "#2e1219";
    pctx.fillRect(26, 29, 3, 4);
    pctx.fillRect(39, 29, 3, 4);
    pctx.fillStyle = "#c99ea6";
    pctx.fillRect(32, 37, 4, 2);
  } else if (kind === "ghost") {
    // 13층의 원혼
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
    // 수사 수첩 & 돋보기 픽셀 일러스트
    pctx.fillStyle = "#5c4938";
    pctx.fillRect(16, 16, 28, 36);
    pctx.fillStyle = "#F2D28B";
    pctx.fillRect(19, 19, 22, 30);
    pctx.fillStyle = "#4a3b2c";
    pctx.fillRect(22, 24, 16, 2);
    pctx.fillRect(22, 29, 14, 2);
    pctx.fillRect(22, 34, 12, 2);
    // 돋보기
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
    // SYSTEM / 13층 인터폰 모니터 아이콘
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

  // 레트로 CRT 스캔라인 효과
  pctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) {
    pctx.fillRect(0, y, W, 1);
  }
}

/* -------------------------------------------------------------------------
   6. 프롤로그 및 순차 튜토리얼 제어
   ------------------------------------------------------------------------- */
function drawPrologueSceneArt(artType) {
  const c = document.getElementById("prologue-art-canvas");
  if (!c) return;
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;

  g.fillStyle = "#090b14";
  g.fillRect(0, 0, W, H);

  if (artType === "apt_night") {
    // 밤하늘 & 은하아파트 실루엣 + 13층 붉은 창문
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
    // 13층 복도 원근 & 벽면 긁힌 자국
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

    // 붉은 비상구 표시등
    g.fillStyle = "#9ce0b8";
    g.fillRect(72, 14, 16, 6);
    // 벽면 긁힌 표시
    g.fillStyle = "#F09BA8";
    for (let i = 0; i < 6; i++) {
      g.fillRect(18 + i * 4, 48, 2, 16);
    }
  } else if (artType === "knock_door") {
    // 1304호 철문과 세 번의 노크 파동
    g.fillStyle = "#261f29";
    g.fillRect(54, 12, 52, 88);
    g.strokeStyle = "#F2D28B";
    g.lineWidth = 1.5;
    g.strokeRect(54, 12, 52, 88);

    g.fillStyle = "#F2D28B";
    g.font = "bold 11px monospace";
    g.textAlign = "center";
    g.fillText("1304", 80, 30);

    // 노크 파동
    g.strokeStyle = "#F09BA8";
    [12, 20, 28].forEach(r => {
      g.beginPath();
      g.arc(80, 56, r, 0, Math.PI * 2);
      g.stroke();
    });
  } else {
    // 강현우 로비 도착
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
  injectEnhancedStylesAndDOM();
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
  drawPrologueSceneArt(scene.art);
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
      <button class="tut-btn" onclick="skipTutorial()">튜토리얼 종료</button>
      <button class="tut-btn" onclick="advanceTutorialStep()">${isLast ? "완료 ✔" : "다음 단계 ▶"}</button>
    </div>
  `;
}

function advanceTutorialStep() {
  if (tutorialStep <= 0) return;
  playSfx("switch");
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    skipTutorial();
    say("강현우", "기본적인 수사 준비는 끝났어. 먼저 1층 복도와 경비실, 주민에게서 단서를 모아보자.", "c-hero");
  } else {
    tutorialStep++;
    renderTutorialBanner();
  }
}

function skipTutorial() {
  tutorialStep = 0;
  flags.tutorialDone = true;
  renderTutorialBanner();
}

/* -------------------------------------------------------------------------
   7. 좌표 · 카메라 · 전방 타일 유틸리티
   ------------------------------------------------------------------------- */
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
      const savedAt = data.savedAt ? ` (${data.savedAt})` : "";
      if (preview) preview.textContent = `저장 기록: [${rName}] 단서 ${cCount}개${savedAt} · 달성 엔딩: ${unlocked.length}/3`;
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
  const pov = document.getElementById("prologue-overlay");
  if (pov) pov.style.display = "none";
  ghost.active = false;
  ghost.warning = false;
  lightState = "on";
  refreshTitleScreen();
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "flex";
}

/* -------------------------------------------------------------------------
   9. UI 및 로그 출력 도우미
   ------------------------------------------------------------------------- */
function say(speaker, text, speakerClass = "c-system", choices = []) {
  injectEnhancedStylesAndDOM();
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

  renderSpeakerPortrait(speaker, speakerClass);

  if (chBox) {
    chBox.innerHTML = "";
    choices.forEach((ch, idx) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `[${idx + 1}] ${ch.label}`;
      btn.onclick = () => {
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
      hint: "조건: 단서 9개 이상 + 핵심 진실 조합(윤서/과거 기억) + 인물과의 진실 공유 후 거울 직면"
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
  if (gameEnded || titleActive || prologueActive) return;
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

  // 구역 조명 상태 HUD
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
        lightStatus.textContent = "지금 즉시 은신처로 이동해 숨으세요 [H]!";
        lightStatus.style.color = "#F09BA8";
      } else {
        lightStatus.textContent = "숨을 곳 없음! 문을 통해 구역을 벗어나세요!";
        lightStatus.style.color = "#F09BA8";
      }
    } else if (lightState === "out") {
      lightText.textContent = "정전 / 암전";
      lightText.style.color = "#F09BA8";
      lightBar.style.width = "0%";
      lightBar.style.background = "#F09BA8";
      lightStatus.textContent = ghost.active ? "원혼 추격 중! 은신하거나 다른 구역으로 도주하세요!" : "조명이 꺼진 어두운 공간";
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
      st.textContent = isHiding ? `은신 중 (${currentHidingLabel})` : "⚠ 원혼 추격 중!";
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
    btnSed.textContent = `신경안정제 [1] (${sedCount})`;
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
        <span class="bag-desc">복용 시 정신력 +30 회복 (단축키: 1)</span>
      </div>
      <button onclick="useConsumable('sedative')" ${sedCount <= 0 ? "disabled" : ""}>사용</button>
    </div>
    <div class="bag-row">
      <div class="bag-info">
        <span class="bag-name">생존 수칙 메모</span>
        <span class="bag-desc">형광등이 깜빡이면(10초) 은신처에서 [H]로 숨거나 다른 구역으로 벗어나세요.</span>
      </div>
    </div>
  `;
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
        const chip = document.createElement("div");
        chip.className = "clue-chip" + (selectedClues.includes(id) ? " selected" : "");
        chip.textContent = c.name;
        chip.title = `${c.importance}\n(연관 힌트: ${c.comboHint})`;
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
  const c = CLUES.find(item => item.id === id);
  if (selectedClues.includes(id)) {
    selectedClues = selectedClues.filter(x => x !== id);
  } else {
    if (selectedClues.length >= 2) selectedClues.shift();
    selectedClues.push(id);
    if (c) {
      say(
        "중요 단서",
        `[${c.name}]\n${c.description}\n\n• 핵심 메모: ${c.importance}\n• [[mint:연관 단서 힌트]]: ${c.comboHint}`,
        "c-clue"
      );
    }
  }
  if (tutorialStep === 3) advanceTutorialStep();
  renderClueUI();
}

function combineSelectedClues() {
  if (gameEnded || titleActive || prologueActive) return;
  if (selectedClues.length < 2) {
    say("SYSTEM", "수사 수첩에서 서로 연관된 단서 2개를 클릭해 선택한 뒤 조합해 주세요.\n(각 단서를 클릭하면 하단에 [[mint:연관 단서 힌트]]가 표시됩니다.)", "c-system");
    return;
  }
  const [a, b] = selectedClues;
  const match = COMBINATIONS.find(c =>
    (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a)
  );

  selectedClues = [];
  renderClueUI();

  if (tutorialStep === 3) advanceTutorialStep();

  if (!match) {
    playSfx("step");
    say("강현우", "이 두 단서만으로는 아직 명확한 연결고리가 떠오르지 않아. 각 단서 아래의 연관 단서 힌트를 확인해 보자.", "c-hero");
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

  say("중요 단서", `증거 조합 성공!\n\n${match.title}\n${match.summary}`, "c-clue");
}

function openDeductionSummary() {
  if (collected.length === 0) {
    say("수사 수첩", "아직 수집된 단서가 없습니다. 주변 사물과 주민들을 조사하세요.", "c-system");
    return;
  }
  const lines = collected.map(id => {
    const c = CLUES.find(item => item.id === id);
    return `■ ${c.name}: ${c.importance}\n   ↳ 힌트: ${c.comboHint}`;
  }).join("\n");
  say("수사 수첩 요약", `현재 확보된 단서 (${collected.length}/${CLUES.length}) · 도출 진실 (${deduced.length}/${COMBINATIONS.length})\n\n${lines}`, "c-clue");
}

/* -------------------------------------------------------------------------
   10. 쯔꾸르(RPG Maker) 타일 보간 이동, 충돌 검사, 은신, 구역 이탈 전환
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
  padKeys[dir] = isDown;
}

function startStep(dx, dy, isSprinting = false) {
  if (gameEnded || titleActive || prologueActive) return false;
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

function tryMove(dx, dy) {
  const isSprinting = (keys["shift"] && stamina > 5 && !isHiding);
  startStep(dx, dy, isSprinting);
}

function getHeldDirection() {
  if (keys["arrowup"] || keys["w"] || padKeys.up) return { dx: 0, dy: -1 };
  if (keys["arrowdown"] || keys["s"] || padKeys.down) return { dx: 0, dy: 1 };
  if (keys["arrowleft"] || keys["a"] || padKeys.left) return { dx: -1, dy: 0 };
  if (keys["arrowright"] || keys["d"] || padKeys.right) return { dx: 1, dy: 0 };
  return null;
}

function updatePlayerMovement(dt) {
  if (bumpCooldown > 0) bumpCooldown = Math.max(0, bumpCooldown - dt);

  const isSprinting = (keys["shift"] && stamina > 5 && !isHiding);
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

      if (!gameEnded && !titleActive && !prologueActive) {
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
  // 13층 복도 점멸/추격 중 엘리베이터 봉쇄
  if (currentRoom === "13층 복도" && door.to === "엘리베이터" && (ghost.active || ghost.warning)) {
    playSfx("ghost");
    say("SYSTEM", "엘리베이터 문이 굳게 닫혀 열리지 않는다!\n원혼의 기운이 출구를 막고 있다. 복도 서쪽의 배전함 캐비닛에 숨어야 한다 [H]!", "c-ghost");
    return;
  }

  // 1304호 현관문 잠금 처리
  if (door.to === "1304호 거실" && currentRoom === "13층 복도" && !flags.door1304Unlocked) {
    if (flags.has1304Key || flags.metYoonseo || collected.length >= 2) {
      flags.door1304Unlocked = true;
      playSfx("door");
      addLog("굳게 닫혀 있던 1304호 현관문이 열렸다.");
    } else {
      say("SYSTEM", "1304호 철문이 잠겨 있다. 1층 경비실이나 주민, 혹은 복도의 소녀에게서 단서를 먼저 찾아보자.", "c-system");
      return;
    }
  }

  // 아이 방 -> 숨겨진 방 비밀 통로 검증
  if (door.secret && !flags.secretOpen) {
    if ((collected.includes("letter") && collected.includes("diary")) || deduced.includes("combo_secret")) {
      flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤의 비밀 통로가 열렸다!");
    } else {
      say("SYSTEM", "벽장 뒤에서 차가운 바람이 새어 나오지만 굳게 막혀 있다.\n집 안의 편지와 일기를 조사해 비밀을 밝혀야 한다.", "c-system");
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
    ghost.warning = false;
    ghost.active = false;
    ghost.escapeRoomCount = 0;
    lightState = "on";
    elevatorFloor = prevRoom === "지하 주차장" ? "지하 주차장" : (prevRoom === "13층 복도" ? "13층 복도" : "1층 복도");
    openElevatorMenu();
    return;
  }

  if (ghost.warning || ghost.active) {
    ghost.escapeRoomCount = (ghost.escapeRoomCount || 0) + 1;
    const isSafeZone = currentRoom === "1층 복도" || currentRoom === "경비실";
    const shookOffByDistance = ghost.active && ghost.escapeRoomCount >= 2;

    if (isSafeZone || shookOffByDistance) {
      ghost.warning = false;
      ghost.active = false;
      ghost.escapeRoomCount = 0;
      lightState = "on";
      playSfx("light_on");
      changeSanity(3, "구역 이탈로 추격 따돌림");
      addLog("구역을 벗어나 원혼의 추적을 따돌렸다!");
      say("SYSTEM", "거친 숨을 몰아쉬며 위험 구역을 완전히 벗어났다! 형광등이 다시 정상적으로 켜졌다.", "c-system");
    } else {
      ghost.room = currentRoom;
      const destHasHide = ROOMS[currentRoom] && ROOMS[currentRoom].hidingSpots.length > 0;
      if (ghost.warning) {
        lightState = "flicker";
        ghost.spawnX = door.tx;
        ghost.spawnY = door.ty;
        const extraGuide = destHasHide
          ? "이 구역의 은신처에 숨거나 한 구역 더 벗어나세요 [H]!"
          : "이곳에도 숨을 곳이 없다! 다음 문으로 계속 도망치세요!";
        addLog(`${currentRoom}으로 빠져나왔다! ${extraGuide}`);
        say("SYSTEM", `${currentRoom}의 형광등까지 심하게 깜빡인다! ${extraGuide}`, "c-system");
      } else {
        lightState = "out";
        ghost.px = door.tx * TILE;
        ghost.py = door.ty * TILE;
        addLog(`정전된 어둠을 틈타 원혼이 ${currentRoom}까지 쫓아왔다! 한 구역 더 벗어나거나 숨으세요!`);
      }
    }
  } else {
    lightState = currentRoom === "1304호 숨겨진 방" ? "out" : "on";
    say("SYSTEM", `${currentRoom}에 들어왔다.`, "c-system");
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
          updateHUD();
        }
      }
    ]
  );
  updateHUD();
}

function toggleHide() {
  if (gameEnded || titleActive || prologueActive) return;
  const r = ROOMS[currentRoom];
  if (isHiding) {
    if (ghost.active || lightState === "flicker") {
      say("SYSTEM", "아직 바깥에 원혼의 기척이 남아 있습니다! 불이 다시 켜질 때까지 숨을 죽이세요.", "c-ghost");
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

  isHiding = true;
  player.moving = false;
  currentHidingLabel = spot.label;
  playSfx("hide");
  addLog(`${spot.label} 안에 몸을 숨겼다.`);

  if (tutorialStep === 4) {
    advanceTutorialStep();
  }

  if (lightState === "flicker") {
    say("SYSTEM", `형광등이 꺼지기 직전 [${spot.label}] 안에 몸을 숨겼다! 불이 다시 들어올 때까지 움직이지 말자.`, "c-system");
  } else {
    say("SYSTEM", `[${spot.label}] 안에 몸을 숨겼다. 숨소리를 죽이고 기척이 사라지길 기다리자.`, "c-system");
  }
  updateHUD();
}

function checkStepEvents() {
  // 지하 주차장: 형광등 점멸 전조 후 원혼 출현 (기둥까지 달리거나 1층 계단으로 구역 이탈 유도)
  if (currentRoom === "지하 주차장" && collected.includes("car_memo") && !flags.parkingGhostSeen && player.x >= 12) {
    flags.parkingGhostSeen = true;
    startGhostWarning(
      "지하 주차장",
      18,
      4,
      "지하 주차장 형광등이 지지직거리며 심하게 깜빡이기 시작했다! 입구 쪽 콘크리트 기둥에 숨거나 1층 계단으로 구역을 벗어나라 [H]!",
      "형광등이 펑 하고 터지며 정전되었다! 어둠 속에서 붉은 눈빛의 원혼이 다가온다!"
    );
    return;
  }

  // 13층 복도: 형광등 점멸 전조 후 원혼 출현 (서쪽 배전함 캐비닛까지 질주 유도)
  if (currentRoom === "13층 복도" && collected.length >= 4 && !flags.hallGhostSeen && player.x >= 11 && player.x <= 18) {
    flags.hallGhostSeen = true;
    startGhostWarning(
      "13층 복도",
      22,
      4,
      "13층 복도의 형광등이 불규칙하게 점멸하며 스파크가 튄다! 복도 서쪽의 배전함 캐비닛까지 달려 숨거나 1304호 안으로 피신하라 [H]!",
      "복도 조명이 완전히 꺼졌다! 암전 속에서 피 묻은 원혼이 비명과 함께 달려온다!"
    );
    return;
  }

  // 1304호 안방에서 병원 기록 확보 후 나올 때: 방 안에 은신처가 없으므로 거실로 구역 이탈 유도!
  if (currentRoom === "1304호 안방" && collected.includes("medical") && !flags.masterGhostSeen && player.x <= 6) {
    flags.masterGhostSeen = true;
    startGhostWarning(
      "1304호 안방",
      13,
      4,
      "안방 형광등이 격렬하게 깜빡이기 시작한다! 이 방에는 몸을 숨길 곳이 없다! 문을 통해 거실로 벗어나 장롱에 숨어라!",
      "안방 불이 꺼지며 어둠 속에서 원혼이 솟아올랐다!"
    );
    return;
  }

  // 1304호 거실: 형광등 점멸 전조 후 원혼 출현
  if (currentRoom === "1304호 거실" && collected.includes("ledger") && !flags.houseGhostSeen) {
    flags.houseGhostSeen = true;
    startGhostWarning(
      "1304호 거실",
      15,
      4,
      "현관 쪽에서 세 번의 노크 소리가 울리더니 거실 형광등이 심하게 깜빡인다! 대형 장롱에 숨거나 복도로 벗어나라 [H]!",
      "거실 불이 완전히 꺼졌다! 정전된 거실로 원혼이 들이닥쳤다!"
    );
  }
}

/* -------------------------------------------------------------------------
   11. 쯔꾸르 전방 타일 정밀 조사 & 상호작용
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
  if (gameEnded || titleActive || prologueActive) return;
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
    say(
      "중요 단서",
      `[${clue.name}]을(를) 발견했다!\n\n${clue.description}\n\n• 수첩 기록: ${clue.importance}\n• [[mint:연관 단서 힌트]]: ${clue.comboHint}`,
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
    }
    playSfx("step");
    updateHUD();
    say(prop.speaker, `[${prop.name}]\n${prop.text}`, prop.speakerClass);
    return;
  }

  if (hit.type === "hiding") {
    say("SYSTEM", `[${hit.target.label}]이다. 형광등이 깜빡이면 [H] 키를 눌러 안에 숨을 수 있다.`, "c-system");
    return;
  }

  if (hit.type === "secret_wall") {
    if (collected.includes("letter") && collected.includes("diary")) {
      flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤 숨겨진 방의 문을 열었다.");
      say("SYSTEM", "편지와 일기의 내용을 떠올리며 벽장 뒤편을 밀자, 숨겨진 방으로 이어지는 비밀 문이 열렸다!", "c-system");
    } else {
      say("강현우", "벽장 뒤에서 서늘한 바람이 새어 나와. 뭔가 숨겨진 공간이 있는 것 같은데...", "c-hero");
    }
  }
}

function talkToNPC(npc) {
  if (npc.id === "park") {
    if (flags.parkHostile && !collected.includes("guard_log") && !collected.includes("car_memo")) {
      say("박만식 (경비원)", "더는 할 말 없소! 어서 이 아파트에서 나가시오!", "c-npc");
      return;
    }
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
        label: "1304호에 들어갈 수 있는 열쇠가 있는지 묻는다",
        action: () => {
          flags.has1304Key = true;
          addLog("박만식으로부터 1304호 예비 열쇠 정보를 얻었다.");
          say("박만식 (경비원)", "...형사 양반이 끝까지 가겠다면 말릴 수 없지. 1304호 문은 녹슬어서 힘껏 밀면 열릴 거요. 그리고 형광등이 깜빡거리면 절대 그 자리에 서 있지 말고 숨으시오.", "c-npc");
        }
      }
    ];
    if (collected.includes("blueprint") || collected.includes("guard_log") || deduced.includes("combo_space")) {
      choices.push({
        label: "[증거 제시] 도면에 없는 13층과 방화문 봉쇄 기록을 추궁한다",
        action: () => {
          flags.parkConfessed = true;
          flags.parkHostile = false;
          flags.has1304Key = true;
          addLog("박만식이 1985년 그날 밤 방화문을 잠근 은폐 사실을 고백했다.");
          say("박만식 (경비원)", "...결국 알아냈군. 그날 밤 1304호 아버지가 빚과 망상에 미쳐 가족을 가뒀어. 난 무서워서 방화문을 잠그고 신고를 늦췄지. 부디 그 아이의 원한을 풀어주게...", "c-npc");
        }
      });
    } else if (collected.includes("car_memo")) {
      choices.push({
        label: "[수첩 제시] 13년 전 구조된 순경의 아들 '강현우'에 대해 묻는다",
        action: () => {
          flags.parkConfessed = true;
          flags.has1304Key = true;
          addLog("박만식이 강현우와 그의 아버지(당시 순경)에 대한 기억을 증언했다.");
          say("박만식 (경비원)", "그 수첩... 강 순경님 것이잖소! 그날 밤 강 순경님이 아이를 구하려 13층에 올라갔다가 실종됐고, 아드님만 홀로 살아남았소... 자네가 바로 그 아이였단 말인가!", "c-npc");
        }
      });
    } else {
      choices.push({
        label: "협조하지 않으면 공무집행방해로 체포하겠다고 압박한다",
        action: () => {
          flags.parkHostile = true;
          changeSanity(-8, "경비원과의 마찰");
          say("박만식 (경비원)", "맘대로 하쇼! 난 이제 한 마디도 안 할 테니까!", "c-npc");
        }
      });
    }
    say("박만식 (경비원)", "이 밤중에 무슨 일이십니까? 은하아파트는 곧 철거될 건물입니다. 13층 같은 건 애초에 없어요.", "c-npc", choices);
  } else if (npc.id === "han") {
    if (flags.hanHostile && !collected.includes("medical") && !collected.includes("photo")) {
      say("한미정 (주민)", "제발 저한테 말 걸지 마세요... 위층에서 또 발소리가 들린단 말이에요.", "c-npc");
      return;
    }
    const choices = [
      {
        label: "밤마다 위층에서 들린다는 발소리에 대해 묻는다",
        action: () => {
          flags.talkedHan = true;
          addLog("주민 한미정에게 매일 밤 11시 47분마다 들리는 울음소리를 들었다.");
          say("한미정 (주민)", "저는 1204호에 살아요. 그런데 매일 밤 11시 47분만 되면 천장 위... 존재하지도 않는 13층에서 여자아이 울음소리와 노크 소리가 들려요. 그 직전엔 꼭 복도 형광등이 깜빡거리더라고요.", "c-npc");
        }
      }
    ];
    if (collected.includes("medical") || collected.includes("photo") || deduced.includes("combo_yoonseo")) {
      choices.push({
        label: "[단서 제시] '윤서'라는 아이에 대해 알고 있는지 묻는다",
        action: () => {
          flags.hanTruth = true;
          flags.hanHostile = false;
          flags.has1304Key = true;
          addLog("한미정이 윤서의 옛 피아노 선생이었음을 밝히고 진실을 증언했다.");
          say("한미정 (주민)", "윤서 이름을 어떻게 아세요...? 저는 13년 전 윤서의 피아노 선생님이었어요. 윤서는 착하고 여린 아이였어요. 그날 밤 윤서를 구하러 갔던 한 소년도 있었는데...", "c-npc");
        }
      });
    } else if (collected.includes("newspaper")) {
      choices.push({
        label: "[신문 제시] 13년째 미뤄진 아파트 철거와 괴담에 대해 묻는다",
        action: () => {
          flags.talkedHan = true;
          flags.has1304Key = true;
          addLog("한미정으로부터 철거 인부들이 13층에서 실종되었던 사건 이야기를 들었다.");
          say("한미정 (주민)", "재개발 조합 사람들이 철거 측량을 하러 올라갔다가 그날 밤 이후로 자취를 감췄대요. 그래서 다들 이 아파트를 떠나고 저만 남았어요...", "c-npc");
        }
      });
    } else {
      choices.push({
        label: "거짓말을 하면 용의선상에 올리겠다고 위협한다",
        action: () => {
          flags.hanHostile = true;
          changeSanity(-8, "주민의 공포와 거부");
          say("한미정 (주민)", "아, 아니에요! 저는 아무것도 몰라요! 저리 가세요!", "c-npc");
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
          addLog("13층 복도의 소녀 윤서와 대화했다.");
          say("윤서", "...아저씨도 13번째 방문자인가요? 우리 집 문은 열려 있어요. 하지만 형광등이 깜빡이면 꼭 숨어야 해요... 아빠가 오고 있다는 신호니까요.", "c-npc");
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
          addLog("윤서에게 진실을 전하여 그녀의 원념을 진정시켰다.");
          say("윤서", "...정말 기억해 주신 거예요? 13년 동안 아무도 제 목소리를 들어주지 않았어요. 숨겨진 방의 거울을 봐주세요... 모든 진실이 거기 있어요.", "c-npc");
        }
      });
    } else {
      choices.push({
        label: "\"원혼이라면 당장 사라져라!\" (적대적으로 경고한다)",
        action: () => {
          changeSanity(-18, "원혼의 분노 촉발");
          startGhostWarning(
            "13층 복도",
            22,
            4,
            "윤서가 고개를 숙이자 천장 형광등이 격렬하게 깜빡이기 시작한다! 복도 서쪽 캐비닛으로 달려 숨어야 한다 [H]!",
            "형광등이 산산조각 나며 정전되었다! 붉은 원혼이 비명을 지르며 달려온다!"
          );
        }
      });
    }
    say("윤서", "......똑, 똑, 똑. 열두 번까지는 참았는데, 열세 번째 노크가 시작됐어요.", "c-npc", choices);
  }
}

/* -------------------------------------------------------------------------
   12. 형광등 점멸 전조 -> 정전 -> 원혼 추격 AI
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

  playSfx("flicker");
  addLog(warningText);
  say("SYSTEM", warningText, "c-system");
  updateHUD();
}

function updateLightingAndGhost(dt) {
  if (gameEnded || titleActive || prologueActive) return;

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
      // 전조 종료 -> 정전(암전) & 원혼 실체화
      ghost.warning = false;
      ghost.active = true;
      ghost.room = currentRoom;
      ghost.px = ghost.spawnX * TILE;
      ghost.py = ghost.spawnY * TILE;
      ghost.patrolTimer = 0;
      lightState = "out";
      playSfx("ghost");

      if (isHiding) {
        addLog("형광등이 꺼졌지만 제때 몸을 숨긴 덕분에 원혼이 위치를 눈치채지 못했다.");
        say("SYSTEM", "조명이 완전히 꺼지고 어둠 속에서 무거운 발소리가 다가온다... 숨을 죽이고 기다리자.", "c-system");
      } else {
        addLog(ghost.chaseText);
        say("13층의 원혼", ghost.chaseText, "c-ghost");
      }
      updateHUD();
    }
    return;
  }

  // 2. 원혼 추격/배회 AI
  if (!ghost.active || ghost.room !== currentRoom) return;

  ghost.heartbeatCooldown -= dt;
  if (ghost.heartbeatCooldown <= 0) {
    playSfx("heartbeat");
    ghost.heartbeatCooldown = 1.05;
  }

  const targetX = player.px;
  const targetY = player.py;

  if (isHiding) {
    ghost.patrolTimer += dt;
    ghost.px += Math.sin(animTick * 0.08) * 35 * dt;
    ghost.py += Math.cos(animTick * 0.06) * 25 * dt;
    if (ghost.patrolTimer >= 4.0) {
      ghost.active = false;
      ghost.escapeRoomCount = 0;
      lightState = "on";
      playSfx("light_on");
      changeSanity(4, "은신 성공으로 위기 극복");
      addLog("원혼이 어둠 속으로 물러나고, 천장 형광등이 다시 켜졌다.");
      say("SYSTEM", "발소리가 멀어지고 지지직거리는 소리와 함께 형광등이 다시 켜졌다!", "c-system");
      updateHUD();
    }
    return;
  }

  const dx = targetX - ghost.px;
  const dy = targetY - ghost.py;
  const dist = Math.hypot(dx, dy);

  const speedPx = (ghost.speed + (sanity < 40 ? 0.5 : 0)) * TILE;

  if (dist > 1) {
    ghost.px += (dx / dist) * speedPx * dt;
    ghost.py += (dy / dist) * speedPx * dt;
  }

  if (dist < TILE * 3.2) {
    sanity = Math.max(0, sanity - 4.5 * dt);
    updateHUD();
    if (sanity <= 0) {
      triggerGameOver("정신 붕괴", "원혼의 저주에 정신을 잠식당한 강현우는 그 자리에서 무너지고 말았다.");
      return;
    }
  }

  if (dist < TILE * 0.55) {
    triggerGameOver("13층의 제물", "제때 숨지 못한 강현우는 붉은 원혼의 손아귀에 붙잡혀 13층의 어둠 속으로 끌려갔다.");
  }
}

/* -------------------------------------------------------------------------
   13. 엔딩 분기 (TRUE END / NORMAL END / BAD END / GAME OVER)
   ------------------------------------------------------------------------- */
function triggerFinalMirrorEvent() {
  const hasEnoughClues = collected.length >= 9;
  const hasTruthCombos = deduced.length >= 4 && (deduced.includes("combo_yoonseo") || deduced.includes("combo_past"));
  const hasHumanConnection = flags.savedYoonseo || (flags.parkConfessed && flags.hanTruth);

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
      label: "[환청 굴복] 문밖에서 들리는 세 번의 노크 소리에 문을 연다",
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
      "거울이 산산조각 나며 봉인되어 있던 13년 전의 기억이 되살아났다.\n\n" +
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
  playSfx("ghost");
  updateHUD();
  addLog(`GAME OVER - ${title}`);
  say(
    `GAME OVER — ${title}`,
    `${reason}\n\n은하아파트 13층의 기록에는 또 한 명의 실종자가 추가되었다.`,
    "c-ghost",
    [
      { label: "마지막 저장 불러오기", action: loadGame },
      { label: "새 게임 시작", action: () => resetGame(false) }
    ]
  );
}

/* -------------------------------------------------------------------------
   14. 저장 및 불러오기 (localStorage · 이전 버전 세이브 완벽 호환)
   ------------------------------------------------------------------------- */
function saveGame() {
  if (gameEnded) {
    say("SYSTEM", "이미 엔딩 또는 게임 오버에 도달한 상태입니다.", "c-system");
    return;
  }
  const now = new Date();
  const savedAt = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const data = {
    version: "1.2.0",
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
  localStorage.setItem("visitorSave", JSON.stringify(data));
  playSfx("clue");
  addLog(`현재 수사 진행 상황을 저장했다. (${savedAt})`);
  say("SYSTEM", `수사 진행 상황이 브라우저에 안전하게 저장되었습니다. (${savedAt})`, "c-system");
}

function loadGame() {
  const raw = localStorage.getItem("visitorSave");
  if (!raw) {
    say("SYSTEM", "저장된 데이터가 없습니다.", "c-system");
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

    sanity = typeof data.sanity === "number" ? data.sanity : 100;
    stamina = typeof data.stamina === "number" ? data.stamina : 100;
    collected = Array.isArray(data.collected) ? data.collected : [];
    deduced = Array.isArray(data.deduced) ? data.deduced : [];
    pickedFieldItems = Array.isArray(data.pickedFieldItems) ? data.pickedFieldItems : [];
    examinedProps = Array.isArray(data.examinedProps) ? data.examinedProps : [];
    inventory = data.inventory && typeof data.inventory === "object"
      ? { sedative: data.inventory.sedative ?? 1 }
      : { sedative: 1 };
    flags = data.flags || {};

    selectedClues = [];
    isHiding = false;
    ghost.warning = false;
    ghost.active = false;
    ghost.escapeRoomCount = 0;
    lightState = currentRoom === "1304호 숨겨진 방" ? "out" : "on";
    gameEnded = false;
    endingType = null;
    titleActive = false;
    prologueActive = false;
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
  injectEnhancedStylesAndDOM();
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
  isHiding = false;
  currentHidingLabel = "";
  updateClockDisplay();
  ghost.warning = false;
  ghost.active = false;
  ghost.escapeRoomCount = 0;
  gameEnded = false;
  endingType = null;
  tutorialStep = 0;
  renderTutorialBanner();

  const logEl = document.getElementById("event-log");
  if (logEl) logEl.innerHTML = "";
  renderInventoryUI();
  renderClueUI();
  updateHUD();
  addLog("1998년 10월 13일 23:47, 은하아파트 수사를 시작했다.");
  say(
    "강현우",
    "여기가 은하아파트 1층 복도인가... 공기가 유난히 차갑고 눅눅해. 제한 시간은 없으니 주변 단서부터 차분히 조사해 보자.",
    "c-hero"
  );

  if (withPrologue) {
    startPrologue();
  }
}

/* -------------------------------------------------------------------------
   15. 쯔꾸르(RPG Maker) 16비트 픽셀 아트 렌더링 엔진
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
  ctx.globalAlpha = 0.94;

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
  if (!hit || gameEnded || titleActive || prologueActive || isHiding) return;
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
    const visRadius = isHiding ? 52 : 76;
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
  ctx.strokeStyle = "#756e85";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = "#F2D28B";
  ctx.fillText("MAP [M]", bx + pad, by + 10);

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

  CLUES.filter(c => c.room === currentRoom && !collected.includes(c.id)).forEach(c => {
    ctx.fillStyle = "#ffe680";
    ctx.fillRect(ox + c.x * scale, oy + c.y * scale, scale, scale);
  });

  NPCS.filter(n => n.room === currentRoom).forEach(n => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(ox + n.x * scale, oy + n.y * scale, scale, scale);
  });

  ctx.fillStyle = "#8FC9FF";
  ctx.fillRect(ox + (player.px / TILE) * scale, oy + (player.py / TILE) * scale, scale + 1, scale + 1);

  if (ghost.active && ghost.room === currentRoom) {
    ctx.fillStyle = "#F09BA8";
    ctx.fillRect(ox + (ghost.px / TILE) * scale, oy + (ghost.py / TILE) * scale, scale + 1, scale + 1);
  }

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
   16. 메인 게임 루프 및 키보드 입력
   ------------------------------------------------------------------------- */
let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (!gameEnded && !titleActive && !prologueActive) {
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
  const k = e.key.toLowerCase();

  // 프롤로그 진행 중 키보드 조작
  if (prologueActive) {
    if ([" ", "enter", "e", "escape"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === "escape") finishPrologue();
    else if (k === " " || k === "enter" || k === "e") advancePrologue();
    return;
  }

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
    e.preventDefault();
  }
  keys[k] = true;

  if (e.repeat || titleActive) return;
  if (k === "e" || k === " ") interact();
  else if (k === "h") toggleHide();
  else if (k === "m") toggleMinimap();
  else if (k === "c") combineSelectedClues();
  else if (k === "i") openDeductionSummary();
  else if (k === "1") useConsumable("sedative");
});

document.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

injectEnhancedStylesAndDOM();
snapCamera();
refreshTitleScreen();
renderInventoryUI();
renderClueUI();
updateClockDisplay();
updateHUD();
requestAnimationFrame(gameLoop);
