/* =========================================================================
   1. 게임 데이터 (단서, 조합, 아이템, 소품, 방, NPC, 프롤로그/회상/튜토리얼)
   ========================================================================= */

export const PROLOGUE_SCENES = [
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

export const FLASHBACK_SCENES = {
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

export const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "튜토리얼 1/4 · 이동 및 전력 질주",
    text: "[[blue:방향키(↑↓←→)]] 또는 [[blue:WASD]]로 이동하고, [[blue:Shift]] 키를 누른 채 이동하면 전력 질주합니다."
  },
  {
    step: 2,
    title: "튜토리얼 2/4 · 주변 가구 및 인물 정밀 조사",
    text: "단서는 가구와 공간 속에 숨겨져 있습니다. 사물·인물에 가까이 다가가 [[gold:돋보기 아이콘]]이 뜨면 [[blue:E]] 또는 [[blue:Space]] 키로 조사하세요."
  },
  {
    step: 3,
    title: "튜토리얼 3/4 · 수사 수첩 추리 조합",
    text: "단서가 2개 이상 모였습니다. [[blue:[Tab]]] 키로 [[gold:수사 수첩]]을 열어 각 단서의 [[mint:추리 질문]]을 읽고 2개를 선택한 뒤 조합하세요. (오답 시 정신력 -5)"
  },
  {
    step: 4,
    title: "튜토리얼 4/4 · 형광등 점멸과 은신 · 숨 참기",
    text: "형광등이 [[red:깜빡이면(10초 유예)]] 추격자가 나타납니다. 시야 밖에서 은신처에 [[blue:[H]]]로 숨은 뒤, 추격자가 접근하면 [[blue:[Space]]]를 눌러 숨을 참으세요!"
  }
];

export const CLUES = [
  {
    id: "newspaper",
    name: "1998년 10월자 낡은 신문",
    room: "1층 복도",
    x: 3, y: 3,
    description: "우편함 틈에 구겨진 조간신문.\n'IMF 한파 속 재개발 표류... 은하아파트 철거 또 연기. 1985년 준공 직후 발생한 1304호 일가족 실종 미제 사건 이후 괴담이 끊이지 않아 입주민이 모두 떠나며 흉가로 방치돼 왔다.'",
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
    x: 3, y: 4,
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
    description: "액자 속에는 네 명의 가족이 서 있다.\n그런데 사진 뒤편 어두운 베란다 창문에 낯선 남자의 얼굴이 비쳐 있다.",
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
    description: "탁자 밑에 떨어진 1304호 관리비 명세서.\n13년째 거주자가 없는데도 매일 밤 11시 47분경 급격한 전기·수도 사용량이 기록되어 있다.",
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
    x: 6, y: 3,
    description: "보관함 속 녹음기 재생...\n'문을 열지 마. 내가 돌아오면 절대 문을 열면 안 돼. 그건 내가 아니야.'\n그 뒤로 세 번의 무거운 노크 소리가 들린다.",
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

export const COMBINATIONS = [
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
    summary: "1985년 그날 밤, 경비원 박만식은 참극을 목격하고도 13층 방화문을 밖에서 잠근 채 출입 기록을 파기했다."
  },
  {
    id: "combo_secret",
    pair: ["letter", "diary"],
    title: "[진실 3] 아이 방 벽장 뒤 밀실",
    summary: "13번째 방문자의 위협을 느낀 어머니는 윤서를 보호하기 위해 아이 방 벽장 뒤에 비밀 방을 만들어 숨겼다."
  },
  {
    id: "combo_yoonseo",
    pair: ["photo", "medical"],
    title: "[진실 4] 소녀 윤서의 정체",
    summary: "윤서는 악령이 아니라 13년 전 아버지의 광기 속에서 홀로 살아남아 구조를 기다리다 13층의 시간에 갇혀버린 소녀다.",
    flashbackKey: "yoonseo"
  },
  {
    id: "combo_past",
    pair: ["car_memo", "ledger"],
    title: "[진실 5] 강현우의 잃어버린 기억",
    summary: "13년 전 사건 현장에서 구조되었던 강 순경의 15세 아들이 바로 강현우 자신이다. 트라우마로 기억을 잃은 채 윤서를 구하기 위해 되돌아온 것이다.",
    flashbackKey: "past"
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

export const FIELD_ITEMS = [
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

export const PROPS = [
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

export const ROOMS = {
  "1층 복도": {
    cols: 20, rows: 9,
    theme: "normal",
    bg: "#1b1d29", floorA: "#272a38", floorB: "#222532", wall: "#4d4a5c",
    furniture: [
      { x: 2, y: 2, w: 3, h: 1, color: "#574b42", label: "우편함", style: "mailbox" },
      { x: 7, y: 2, w: 2, h: 1, color: "#444c5e", label: "현관 게시판", style: "board" },
      { x: 14, y: 6, w: 3, h: 1, color: "#3d4454", label: "안내판", style: "board" }
    ],
    hidingSpots: [
      { id: "hide_1f", x: 11, y: 2, label: "계단실 청소함" }
    ],
    doors: [
      { x: 1, y: 4, to: "경비실", tx: 13, ty: 4, label: "경비실" },
      { x: 10, y: 7, to: "지하 주차장", tx: 10, ty: 2, label: "지하 주차장" },
      { x: 18, y: 3, to: "엘리베이터", tx: 3, ty: 4, label: "엘리베이터" }
    ]
  },
  "경비실": {
    cols: 16, rows: 9,
    theme: "normal",
    bg: "#1d1a24", floorA: "#2d2836", floorB: "#27232f", wall: "#594e63",
    furniture: [
      { x: 2, y: 2, w: 3, h: 2, color: "#5c493e", label: "경비 책상", style: "desk" },
      { x: 7, y: 2, w: 2, h: 1, color: "#364652", label: "CCTV", style: "cctv" }
    ],
    hidingSpots: [
      { id: "hide_guard", x: 11, y: 2, label: "경비실 캐비닛" }
    ],
    doors: [
      { x: 14, y: 4, to: "1층 복도", tx: 2, ty: 4, label: "1층 복도" }
    ]
  },
  "지하 주차장": {
    cols: 22, rows: 11,
    theme: "basement",
    bg: "#13161c", floorA: "#1e222b", floorB: "#1a1e26", wall: "#3c424f",
    furniture: [
      { x: 2, y: 5, w: 3, h: 2, color: "#3b4c5e", label: "순찰 차량", style: "car" },
      { x: 8, y: 6, w: 2, h: 1, color: "#353b47", label: "분전함", style: "board" },
      { x: 15, y: 6, w: 3, h: 2, color: "#4a3b3b", label: "방치 폐차", style: "car" }
    ],
    hidingSpots: [
      { id: "hide_b1", x: 6, y: 3, label: "콘크리트 기둥" },
      { id: "hide_b1_east", x: 19, y: 3, label: "기계실 격벽" }
    ],
    doors: [
      { x: 10, y: 1, to: "1층 복도", tx: 10, ty: 6, label: "1층 계단" }
    ]
  },
  "엘리베이터": {
    cols: 12, rows: 9,
    theme: "elevator",
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
    theme: "cursed",
    bg: "#161118", floorA: "#241c26", floorB: "#1f1821", wall: "#543944",
    furniture: [
      { x: 4, y: 2, w: 2, h: 1, color: "#4a3338", label: "녹슨 소화전", style: "hydrant" },
      { x: 13, y: 2, w: 2, h: 1, color: "#3d2930", label: "봉인된 1302호", style: "board" },
      { x: 21, y: 6, w: 3, h: 1, color: "#3b2c33", label: "폐가구", style: "desk" }
    ],
    hidingSpots: [
      { id: "hide_13f", x: 7, y: 6, label: "배전함 캐비닛" },
      { id: "hide_13f_east", x: 20, y: 3, label: "비상계단 틈새" }
    ],
    doors: [
      { x: 1, y: 4, to: "엘리베이터", tx: 3, ty: 4, label: "엘리베이터" },
      { x: 18, y: 1, to: "1304호 거실", tx: 9, ty: 8, label: "1304호" }
    ]
  },
  "1304호 거실": {
    cols: 18, rows: 10,
    theme: "cursed",
    bg: "#21222e", floorA: "#2e2f3d", floorB: "#282936", wall: "#545163",
    furniture: [
      { x: 5, y: 2, w: 3, h: 1, color: "#635144", label: "낡은 소파", style: "sofa" },
      { x: 10, y: 5, w: 3, h: 1, color: "#464759", label: "탁자", style: "desk" }
    ],
    hidingSpots: [
      { id: "hide_living", x: 2, y: 2, label: "거실 대형 장롱" }
    ],
    doors: [
      { x: 9, y: 8, to: "13층 복도", tx: 18, ty: 2, label: "13층 복도" },
      { x: 16, y: 4, to: "1304호 안방", tx: 2, ty: 4, label: "안방" },
      { x: 9, y: 1, to: "1304호 아이 방", tx: 8, ty: 6, label: "아이 방" }
    ]
  },
  "1304호 안방": {
    cols: 16, rows: 9,
    theme: "cursed",
    bg: "#241d26", floorA: "#302733", floorB: "#29212b", wall: "#634d5c",
    furniture: [
      { x: 5, y: 2, w: 4, h: 2, color: "#6e4c56", label: "낡은 침대", style: "bed" },
      { x: 10, y: 2, w: 2, h: 1, color: "#4a3848", label: "화장대", style: "desk" }
    ],
    hidingSpots: [
      { id: "hide_master", x: 13, y: 6, label: "안방 붙박이장" }
    ],
    doors: [
      { x: 1, y: 4, to: "1304호 거실", tx: 15, ty: 4, label: "거실" }
    ]
  },
  "1304호 아이 방": {
    cols: 16, rows: 9,
    theme: "cursed",
    bg: "#1f2533", floorA: "#2a3242", floorB: "#242b38", wall: "#4f5e75",
    furniture: [
      { x: 3, y: 2, w: 3, h: 2, color: "#465a6e", label: "어린이 침대", style: "bed" },
      { x: 10, y: 5, w: 2, h: 1, color: "#475066", label: "책상", style: "desk" }
    ],
    hidingSpots: [
      { id: "hide_child", x: 12, y: 2, label: "아이 방 책장 뒤" }
    ],
    doors: [
      { x: 8, y: 7, to: "1304호 거실", tx: 9, ty: 2, label: "거실" },
      { x: 14, y: 4, to: "1304호 숨겨진 방", tx: 2, ty: 4, label: "숨겨진 방", secret: true }
    ]
  },
  "1304호 숨겨진 방": {
    cols: 16, rows: 9,
    theme: "cursed",
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

export const NPCS = [
  { id: "park", name: "박만식", role: "경비원", room: "경비실", x: 4, y: 4, dir: "down" },
  { id: "han", name: "한미정", role: "아파트 주민", room: "1층 복도", x: 6, y: 4, dir: "down" },
  { id: "yoonseo", name: "윤서", role: "13층의 소녀", room: "13층 복도", x: 15, y: 3, dir: "down" }
];
