/* =========================================================================
   6. UI · 대화창 포트레이트 · 타자기 연출 · 애니메이션 컷신 · 수첩 모듈 (v1.7.0)
   ========================================================================= */
import { CLUES, COMBINATIONS, PROPS, TUTORIAL_STEPS } from "./data.js";
import { UI_CONFIG } from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE, setGameMode, clearHeldInputs,
  getUnlockedEndings, markHudDirty
} from "./state.js";
import { playSfx, playVoiceBlip } from "./audio.js";

const hudCache = {
  location: null,
  sanityInt: null,
  sanityColor: null,
  staminaInt: null,
  showFlicker: null,
  showDanger: null,
  progress: null,
  endings: null,
  props: null,
  allPropsDone: null,
  sedative: null,
  reducedMotion: null
};

const hudRefs = {};

function getHudRef(id) {
  if (!hudRefs[id]) {
    hudRefs[id] = document.getElementById(id);
  }
  return hudRefs[id];
}

export function resetHudCache() {
  Object.keys(hudCache).forEach(k => { hudCache[k] = null; });
  state.hudDirty = true;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatHighlightedDialogue(rawText) {
  let html = escapeHtml(rawText);

  // 내부에 단일 ']'가 포함된 태그([[blue:[Space]]])도 안전하게 파싱
  html = html.replace(/\[\[(gold|blue|red|mint):((?:[^\[\]]|\[[^\]]*\])+)\]\]/g, (_, cls, inner) => {
    return `<span class="hl-${cls}">${inner}</span>`;
  });

  const rules = [
    {
      cls: "hl-gold",
      regex: /(1985년 10월 13일|1998년 10월 13일|1999년 10월 13일|11시 47분|23:47|1304호|1303호|1302호|1204호|13층|열세 번째|13번째 방문자|방문자 명부|준공 도면|근무일지|녹음기|가족사진|병원 기록|아이의 일기|찢어진 편지|관리비 고지서|추리 질문|추가 추리 질문|핵심 해석|돋보기 아이콘)/g
    },
    {
      cls: "hl-blue",
      regex: /(강현우|강 순경|윤서|박만식|한미정|벽장 뒤|숨겨진 방|낡은 거울|이름 복원|\[H\]|\[E\]|\[C\]|\[M\]|\[Q\]|\[Tab\]|\[Space\])/g
    },
    {
      cls: "hl-red",
      regex: /(형광등이 격렬하게 깜빡|형광등이 불규칙하게 점멸|형광등이 심하게 깜빡|형광등이 깜빡이면|형광등이 깜빡거리면|문을 열지 마|정전|노크 소리|몸을 숨길 곳이 없다|GAME OVER|BAD END)/g
    },
    {
      cls: "hl-mint",
      regex: /(은신|숨기|캐비닛|대형 장롱|콘크리트 기둥|신경안정제|TRUE END|숨을 참|정신 내성)/g
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

/* -------------------------------------------------------------------------
   HTML-Safe 타자기(Typewriter) 텍스트 출력 엔진
   ------------------------------------------------------------------------- */
const typewriter = {
  active: false,
  targetId: "message",
  fullHtml: "",
  tokens: [],
  visibleChars: 0,
  totalChars: 0,
  timer: 0,
  cps: UI_CONFIG.TYPEWRITER_CHARS_PER_SEC,
  speaker: "",
  blipCounter: 0
};

function tokenizeFormattedHtml(html) {
  const tokens = [];
  let totalChars = 0;
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const closeIdx = html.indexOf(">", i);
      if (closeIdx !== -1) {
        const tag = html.slice(i, closeIdx + 1);
        tokens.push({ type: "tag", value: tag });
        i = closeIdx + 1;
        continue;
      }
    }
    if (html[i] === "&") {
      const semiIdx = html.indexOf(";", i);
      if (semiIdx !== -1 && semiIdx - i <= 8) {
        const entity = html.slice(i, semiIdx + 1);
        tokens.push({ type: "char", value: entity });
        totalChars++;
        i = semiIdx + 1;
        continue;
      }
    }
    tokens.push({ type: "char", value: html[i] });
    totalChars++;
    i++;
  }
  return { tokens, totalChars };
}

function buildPartialHtml(tokens, maxChars) {
  let out = "";
  let count = 0;
  let openSpans = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === "tag") {
      if (count >= maxChars && tok.value === "<br>") break;
      out += tok.value;
      if (tok.value.startsWith("<span")) openSpans++;
      else if (tok.value === "</span>" && openSpans > 0) openSpans--;
    } else {
      if (count >= maxChars) break;
      out += tok.value;
      count++;
    }
  }
  while (openSpans > 0) {
    out += "</span>";
    openSpans--;
  }
  return out;
}

export function startTypewriter(targetId, rawText, speaker = "", cps = UI_CONFIG.TYPEWRITER_CHARS_PER_SEC) {
  const el = document.getElementById(targetId);
  const fullHtml = formatHighlightedDialogue(rawText);
  if (!el) return;

  const { tokens, totalChars } = tokenizeFormattedHtml(fullHtml);
  typewriter.active = totalChars > 0;
  typewriter.targetId = targetId;
  typewriter.fullHtml = fullHtml;
  typewriter.tokens = tokens;
  typewriter.visibleChars = 0;
  typewriter.totalChars = totalChars;
  typewriter.timer = 0;
  typewriter.cps = cps;
  typewriter.speaker = speaker;
  typewriter.blipCounter = 0;

  if (totalChars === 0) {
    el.innerHTML = "";
    typewriter.active = false;
  } else {
    el.innerHTML = '<span class="tw-cursor">▌</span>';
  }
}

export function isTypewriterActive(targetId = null) {
  if (!typewriter.active) return false;
  if (targetId && typewriter.targetId !== targetId) return false;
  return true;
}

export function finishTypewriter() {
  if (!typewriter.active) return false;
  typewriter.active = false;
  typewriter.visibleChars = typewriter.totalChars;
  const el = document.getElementById(typewriter.targetId);
  if (el) el.innerHTML = typewriter.fullHtml;
  return true;
}

export function updateTypewriter(dt) {
  if (!typewriter.active) return;
  typewriter.timer += dt;
  const nextCount = Math.min(typewriter.totalChars, Math.floor(typewriter.timer * typewriter.cps));
  if (nextCount > typewriter.visibleChars) {
    const prevCount = typewriter.visibleChars;
    typewriter.visibleChars = nextCount;
    typewriter.blipCounter += (nextCount - prevCount);

    if (typewriter.blipCounter >= 3) {
      typewriter.blipCounter = 0;
      let lastChar = "";
      for (let k = nextCount - 1; k >= 0; k--) {
        let seen = 0;
        for (let tIdx = 0; tIdx < typewriter.tokens.length; tIdx++) {
          if (typewriter.tokens[tIdx].type === "char") {
            if (seen === k) { lastChar = typewriter.tokens[tIdx].value; break; }
            seen++;
          }
        }
        if (lastChar && lastChar.trim()) break;
      }
      playVoiceBlip(typewriter.speaker, lastChar);
    }

    const el = document.getElementById(typewriter.targetId);
    if (el) {
      if (typewriter.visibleChars >= typewriter.totalChars) {
        typewriter.active = false;
        el.innerHTML = typewriter.fullHtml;
      } else {
        el.innerHTML = buildPartialHtml(typewriter.tokens, typewriter.visibleChars) + '<span class="tw-cursor">▌</span>';
      }
    }
  }
}

const portraitState = {
  speaker: "SYSTEM",
  expression: "normal",
  blinkTimer: 2.6,
  isBlinking: false
};

export function inferPortraitExpression(speakerName = "", text = "", speakerClass = "c-system") {
  const combined = `${speakerName} ${text}`;
  if (
    speakerClass === "c-ghost" ||
    state.ghost.state === GHOST_STATE.CHASE ||
    state.ghost.state === GHOST_STATE.SEARCH ||
    /비명|도망|숨을 참|방문자|발각|피|살려|노크 소리|정전|GAME OVER|BAD END/.test(combined)
  ) {
    return "fear";
  }
  if (/진실|기억|핵심 해석|단서|TRUE END|열렸다|단서 조합/.test(combined)) {
    return "truth";
  }
  if (/미안|엄마|아빠|아들|눈물|슬프|사라진|혼자|무서워|죄송|윤서/.test(combined)) {
    return "sad";
  }
  if (state.sanity <= 55 || state.lightState === "flicker" || /경고|위험|수상|조심|잠겨|불안/.test(combined)) {
    return "tense";
  }
  return "normal";
}

export function getPortraitState() {
  return { ...portraitState };
}

export function updatePortraitAnimation(dt) {
  if (state.dialogueHidden || state.mode === GAME_MODE.TITLE || state.mode === GAME_MODE.PROLOGUE) return;
  if (state.prefs.reducedMotion) {
    if (portraitState.isBlinking) {
      portraitState.isBlinking = false;
      renderSpeakerPortrait(portraitState.speaker, { expression: portraitState.expression, preserveBlink: true });
    }
    return;
  }

  portraitState.blinkTimer -= dt;
  if (!portraitState.isBlinking && portraitState.blinkTimer <= 0) {
    portraitState.isBlinking = true;
    portraitState.blinkTimer = 0.13;
    renderSpeakerPortrait(portraitState.speaker, { expression: portraitState.expression, preserveBlink: true });
  } else if (portraitState.isBlinking && portraitState.blinkTimer <= 0) {
    portraitState.isBlinking = false;
    portraitState.blinkTimer = 2.4 + Math.random() * 2.2;
    renderSpeakerPortrait(portraitState.speaker, { expression: portraitState.expression, preserveBlink: true });
  }
}

export function renderSpeakerPortrait(speakerName, options = {}) {
  const name = speakerName || "SYSTEM";
  portraitState.speaker = name;
  if (options.expression) {
    portraitState.expression = options.expression;
  } else if (!options.preserveBlink) {
    portraitState.expression = inferPortraitExpression(name);
  }
  if (!options.preserveBlink) {
    portraitState.isBlinking = false;
    portraitState.blinkTimer = 2.5 + Math.random() * 1.8;
  }

  const pCanvas = getHudRef("portrait-canvas");
  const pRole = getHudRef("portrait-role");
  if (!pCanvas || !pRole) return;

  const pctx = pCanvas.getContext("2d");
  if (!pctx) return;
  const W = pCanvas.width;
  const H = pCanvas.height;
  pctx.imageSmoothingEnabled = false;
  pctx.clearRect(0, 0, W, H);

  let kind = "system";
  let roleLabel = "SYSTEM";

  if (name.includes("강현우")) { kind = "hero"; roleLabel = "신입 형사"; }
  else if (name.includes("박만식")) { kind = "park"; roleLabel = "경비원"; }
  else if (name.includes("한미정")) { kind = "han"; roleLabel = "1204호 주민"; }
  else if (name.includes("윤서")) { kind = "yoonseo"; roleLabel = "13층의 소녀"; }
  else if (name.includes("방문자") || name.includes("BAD END") || name.includes("GAME OVER")) {
    kind = "ghost"; roleLabel = "13번째 방문자";
  } else if (name.includes("단서") || name.includes("수첩") || name.includes("진실") || name.includes("TRUE END")) {
    kind = "clue"; roleLabel = "수사 기록";
  }

  const expr = portraitState.expression;
  const blinking = portraitState.isBlinking && !state.prefs.reducedMotion;
  pRole.textContent = roleLabel;

  // 표정 및 화자 테마 배경 그라데이션
  const bg = pctx.createLinearGradient(0, 0, 0, H);
  if (expr === "fear" && kind !== "clue") {
    bg.addColorStop(0, "#38121d"); bg.addColorStop(1, "#12060a");
  } else if (kind === "hero") {
    bg.addColorStop(0, expr === "truth" ? "#1d354f" : "#182438");
    bg.addColorStop(1, "#0d131f");
  } else if (kind === "park") {
    bg.addColorStop(0, "#1c2b28"); bg.addColorStop(1, "#0f1715");
  } else if (kind === "han") {
    bg.addColorStop(0, "#2b1d2c"); bg.addColorStop(1, "#140d15");
  } else if (kind === "yoonseo") {
    bg.addColorStop(0, "#24283b"); bg.addColorStop(1, "#10121c");
  } else if (kind === "ghost") {
    bg.addColorStop(0, "#42111d"); bg.addColorStop(1, "#140508");
  } else if (kind === "clue") {
    bg.addColorStop(0, "#332918"); bg.addColorStop(1, "#14110b");
  } else {
    bg.addColorStop(0, "#1b2030"); bg.addColorStop(1, "#0d1018");
  }
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, W, H);

  // 표정별 눈썹/눈/입 헬퍼
  const drawFaceFeatures = (eyeY, leftX, rightX, irisColor, mouthY) => {
    // 눈썹
    pctx.fillStyle = "#191821";
    if (expr === "tense" || expr === "truth") {
      pctx.fillRect(leftX - 1, eyeY - 4, 6, 2);
      pctx.fillRect(rightX - 1, eyeY - 4, 6, 2);
      pctx.fillRect(leftX + 3, eyeY - 3, 2, 1);
      pctx.fillRect(rightX - 1, eyeY - 3, 2, 1);
    } else if (expr === "fear" || expr === "sad") {
      pctx.fillRect(leftX - 1, eyeY - 3, 5, 1);
      pctx.fillRect(leftX + 2, eyeY - 4, 3, 1);
      pctx.fillRect(rightX, eyeY - 3, 5, 1);
      pctx.fillRect(rightX - 1, eyeY - 4, 3, 1);
    } else {
      pctx.fillRect(leftX - 1, eyeY - 4, 6, 2);
      pctx.fillRect(rightX - 1, eyeY - 4, 6, 2);
    }

    // 눈 (깜빡임 vs 표정별 동공)
    if (blinking) {
      pctx.fillStyle = "#2b2226";
      pctx.fillRect(leftX - 1, eyeY + 2, 6, 2);
      pctx.fillRect(rightX - 1, eyeY + 2, 6, 2);
    } else {
      pctx.fillStyle = "#f2f4fa";
      pctx.fillRect(leftX - 1, eyeY, 6, 4);
      pctx.fillRect(rightX - 1, eyeY, 6, 4);

      pctx.fillStyle = irisColor;
      const pupilH = expr === "fear" ? 3 : 4;
      const pupilW = expr === "fear" ? 2 : 3;
      pctx.fillRect(leftX + 1, eyeY, pupilW, pupilH);
      pctx.fillRect(rightX + 1, eyeY, pupilW, pupilH);

      pctx.fillStyle = "#ffffff";
      pctx.fillRect(leftX + 1, eyeY, 1, 1);
      pctx.fillRect(rightX + 1, eyeY, 1, 1);
    }

    // 입
    pctx.fillStyle = "#9c6858";
    if (expr === "fear") {
      pctx.fillStyle = "#4d2329";
      pctx.fillRect(32, mouthY - 1, 4, 4);
    } else if (expr === "truth") {
      pctx.fillRect(31, mouthY, 6, 2);
      pctx.fillRect(36, mouthY - 1, 2, 1);
    } else if (expr === "sad" || expr === "tense") {
      pctx.fillRect(31, mouthY + 1, 6, 1);
      pctx.fillRect(30, mouthY + 2, 1, 1);
      pctx.fillRect(37, mouthY + 2, 1, 1);
    } else {
      pctx.fillRect(31, mouthY, 6, 2);
    }
  };

  if (kind === "hero") {
    // 어깨 & 트렌치코트
    pctx.fillStyle = "#263b59"; pctx.fillRect(11, 46, 46, 22);
    pctx.fillStyle = "#1a2940"; pctx.fillRect(25, 46, 18, 22);
    pctx.fillStyle = "#9fd2ff"; pctx.fillRect(29, 47, 10, 14);
    pctx.fillStyle = "#141c2b"; pctx.fillRect(33, 49, 2, 14);
    // 목 & 턱 음영
    pctx.fillStyle = "#d4a487"; pctx.fillRect(29, 40, 10, 7);
    pctx.fillStyle = "#f2cbb0"; pctx.fillRect(21, 18, 26, 23);
    pctx.fillStyle = "#e0b396"; pctx.fillRect(21, 38, 26, 3);
    // 머리카락 & 하이라이트
    pctx.fillStyle = "#151721";
    pctx.fillRect(19, 10, 30, 10); pctx.fillRect(19, 18, 4, 15); pctx.fillRect(45, 18, 4, 15);
    pctx.fillStyle = "#2c344a";
    pctx.fillRect(24, 12, 16, 2);
    drawFaceFeatures(28, 25, 39, "#0e121c", 36);
    if (expr === "fear" || expr === "tense") {
      // 식은땀 도트
      pctx.fillStyle = "#8FC9FF";
      pctx.fillRect(43, 22, 2, 4);
    }
  } else if (kind === "park") {
    pctx.fillStyle = "#35544e"; pctx.fillRect(11, 47, 46, 21);
    pctx.fillStyle = "#f2d28b"; pctx.fillRect(14, 48, 8, 3); pctx.fillRect(46, 48, 8, 3);
    pctx.fillStyle = "#c99e83"; pctx.fillRect(29, 41, 10, 6);
    pctx.fillStyle = "#e0b89d"; pctx.fillRect(21, 20, 26, 22);
    // 경비원 제복 모자 & 금장 휘장
    pctx.fillStyle = "#223330"; pctx.fillRect(17, 10, 34, 9);
    pctx.fillStyle = "#111a18"; pctx.fillRect(16, 18, 36, 3);
    pctx.fillStyle = "#F2D28B"; pctx.fillRect(32, 13, 4, 4);
    drawFaceFeatures(27, 25, 39, "#141414", 36);
  } else if (kind === "han") {
    pctx.fillStyle = "#6e4b6b"; pctx.fillRect(12, 47, 44, 21);
    pctx.fillStyle = "#8a6286"; pctx.fillRect(25, 48, 18, 20);
    pctx.fillStyle = "#f2cbb0"; pctx.fillRect(22, 20, 24, 22);
    pctx.fillStyle = "#291b23"; pctx.fillRect(18, 11, 32, 10);
    pctx.fillRect(18, 19, 5, 25); pctx.fillRect(45, 19, 5, 25);
    pctx.fillStyle = "#452e3b"; pctx.fillRect(23, 13, 18, 2);
    drawFaceFeatures(27, 25, 39, "#1c1318", 36);
  } else if (kind === "yoonseo") {
    // 영체 빛무리
    pctx.fillStyle = "rgba(143, 201, 255, 0.16)";
    pctx.beginPath(); pctx.arc(34, 34, 28, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = "#dce3ed"; pctx.fillRect(15, 48, 38, 20);
    pctx.fillStyle = "#f5e8ea"; pctx.fillRect(23, 21, 22, 21);
    pctx.fillStyle = "#14131a"; pctx.fillRect(19, 12, 30, 10);
    pctx.fillRect(19, 20, 4, 28); pctx.fillRect(45, 20, 4, 28);
    drawFaceFeatures(28, 26, 39, "#3d1620", 36);
  } else if (kind === "ghost") {
    pctx.fillStyle = "rgba(240, 155, 168, 0.25)";
    pctx.beginPath(); pctx.arc(34, 34, 27, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = "#17090d"; pctx.fillRect(16, 13, 36, 50);
    pctx.fillStyle = "#4a1320"; pctx.fillRect(20, 43, 28, 25);
    pctx.fillStyle = "#F09BA8"; pctx.fillRect(23, 27, 7, 4); pctx.fillRect(38, 28, 7, 3);
    pctx.fillStyle = "#ffffff"; pctx.fillRect(25, 28, 2, 2); pctx.fillRect(40, 28, 2, 1);
  } else if (kind === "clue") {
    pctx.fillStyle = "#5c4938"; pctx.fillRect(16, 15, 36, 38);
    pctx.fillStyle = "#F2D28B"; pctx.fillRect(19, 18, 30, 32);
    pctx.fillStyle = "#4a3b2c";
    pctx.fillRect(23, 24, 20, 2); pctx.fillRect(23, 30, 18, 2); pctx.fillRect(23, 36, 14, 2);
  } else {
    pctx.strokeStyle = "#8FC9FF"; pctx.lineWidth = 2; pctx.strokeRect(14, 16, 40, 30);
    pctx.fillStyle = "#F2D28B"; pctx.font = "bold 12px monospace"; pctx.textAlign = "center";
    pctx.fillText("13F", 34, 34);
  }

  pctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) pctx.fillRect(0, y, W, 1);
}

export function closeDialogueBox() {
  if (state.mode === GAME_MODE.ENDED) return;
  if (isTypewriterActive("message")) {
    finishTypewriter();
  }
  const overlay = getHudRef("dialogue-overlay");
  const visualRow = getHudRef("dialogue-visual-row");
  const chBox = getHudRef("choices");
  const tutBanner = getHudRef("tutorial-banner");

  if (state.activeChoices.length > 0) {
    state.activeChoices = [];
  }
  if (chBox) {
    chBox.innerHTML = "";
  }
  if (state.mode === GAME_MODE.DIALOGUE) {
    setGameMode(GAME_MODE.PLAY);
  }
  state.dialogueHidden = true;
  if (visualRow) visualRow.style.display = "none";

  const hasTutorial = tutBanner && tutBanner.style.display !== "none" && tutBanner.style.display !== "";
  if (overlay && !hasTutorial) {
    overlay.style.display = "none";
  }
}

export function say(speaker, text, speakerClass = "c-system", choices = [], options = {}) {
  const overlay = getHudRef("dialogue-overlay");
  const visualRow = getHudRef("dialogue-visual-row");
  const closeBtn = getHudRef("btn-dialogue-close");
  const sp = getHudRef("speaker");
  const msg = getHudRef("message");
  const chBox = getHudRef("choices");

  state.dialogueHidden = false;
  if (overlay) overlay.style.display = "block";
  if (visualRow) visualRow.style.display = "flex";
  if (closeBtn) {
    closeBtn.style.display = state.mode === GAME_MODE.ENDED ? "none" : "flex";
  }

  state.lastDialogueImportant = speakerClass !== "c-system" || (Array.isArray(choices) && choices.length > 0);

  if (sp) {
    sp.textContent = speaker;
    sp.className = speakerClass;
  }
  if (msg) {
    msg.className = "c-npc";
    if (options.instant) {
      typewriter.active = false;
      msg.innerHTML = formatHighlightedDialogue(text);
    } else {
      startTypewriter("message", text, speaker, UI_CONFIG.TYPEWRITER_CHARS_PER_SEC);
    }
  }

  const expr = options.expression || inferPortraitExpression(speaker, text, speakerClass);
  renderSpeakerPortrait(speaker, { expression: expr });

  state.activeChoices = Array.isArray(choices) ? choices.slice() : [];
  if (state.activeChoices.length > 0 && state.mode === GAME_MODE.PLAY) {
    setGameMode(GAME_MODE.DIALOGUE);
  } else if (state.activeChoices.length === 0 && state.mode === GAME_MODE.DIALOGUE) {
    setGameMode(GAME_MODE.PLAY);
  }

  if (chBox) {
    chBox.innerHTML = "";
    state.activeChoices.forEach((ch, idx) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = `[${idx + 1}] ${ch.label}`;
      btn.addEventListener("click", () => {
        finishTypewriter();
        state.activeChoices = [];
        chBox.innerHTML = "";
        if (state.mode === GAME_MODE.DIALOGUE) setGameMode(GAME_MODE.PLAY);
        ch.action();
      });
      chBox.appendChild(btn);
    });
  }
  if (closeBtn) {
    closeBtn.style.display = state.mode === GAME_MODE.ENDED ? "none" : "flex";
  }
}

export function addLog(text) {
  const logBox = getHudRef("event-log");
  if (!logBox) return;
  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = `• [${state.currentRoom}] ${text}`;
  logBox.prepend(div);
  while (logBox.children.length > UI_CONFIG.MAX_LOG_ENTRIES) {
    logBox.removeChild(logBox.lastChild);
  }
}

export function toggleNotebookDrawer(forceState = null) {
  if (state.mode === GAME_MODE.TITLE || state.mode === GAME_MODE.PROLOGUE || state.mode === GAME_MODE.FLASHBACK) return;
  state.notebookOpen = forceState !== null ? forceState : !state.notebookOpen;
  const drawer = getHudRef("notebook-drawer");
  const btn = getHudRef("btn-notebook");
  if (drawer) drawer.classList.toggle("open", state.notebookOpen);
  if (btn) btn.textContent = state.notebookOpen ? "수사 수첩 닫기 [Tab]" : "수사 수첩 · 소지품 [Tab]";
  if (state.notebookOpen) clearHeldInputs();
  playSfx("switch");
}

export function updateHUD(force = false) {
  const sanInt = Math.round(state.sanity);
  const stamInt = Math.round(state.stamina);
  const sanColor = state.sanity > 60 ? "#8FC9FF" : (state.sanity > 30 ? "#F2D28B" : "#F09BA8");
  const showFlicker = state.lightState === "flicker" && !state.isHiding && state.mode !== GAME_MODE.ENDED;
  const isChase = state.ghost.state === GHOST_STATE.CHASE || state.ghost.state === GHOST_STATE.SEARCH;
  const showDanger = isChase && state.mode !== GAME_MODE.ENDED;
  const progStr = `단서 ${state.collected.length}/${CLUES.length} · 진실 ${state.deduced.length}/${COMBINATIONS.length}`;
  const unlocked = getUnlockedEndings();
  const endStr = `달성 엔딩: ${unlocked.length}/3` + (unlocked.length ? ` (${unlocked.join(", ")})` : "");
  const allPropsDone = Boolean(state.flags.allPropsExamined || state.examinedProps.length >= PROPS.length);
  const propStr = allPropsDone
    ? `환경 조사: ${PROPS.length}/${PROPS.length} ★`
    : `환경 조사: ${state.examinedProps.length}/${PROPS.length}`;
  const sedCount = state.inventory.sedative || 0;
  const reduced = Boolean(state.prefs.reducedMotion);

  if (!force && !state.hudDirty &&
      hudCache.location === state.currentRoom &&
      hudCache.sanityInt === sanInt &&
      hudCache.staminaInt === stamInt &&
      hudCache.showFlicker === showFlicker &&
      hudCache.showDanger === showDanger &&
      hudCache.progress === progStr &&
      hudCache.endings === endStr &&
      hudCache.props === propStr &&
      hudCache.allPropsDone === allPropsDone &&
      hudCache.sedative === sedCount &&
      hudCache.reducedMotion === reduced) {
    return;
  }

  state.hudDirty = false;

  if (hudCache.location !== state.currentRoom) {
    hudCache.location = state.currentRoom;
    const locEl = getHudRef("hud-location");
    if (locEl) locEl.textContent = `은하아파트 · ${state.currentRoom}`;
  }

  if (hudCache.sanityInt !== sanInt || hudCache.sanityColor !== sanColor) {
    hudCache.sanityInt = sanInt;
    hudCache.sanityColor = sanColor;
    const sanText = getHudRef("sanity-text");
    if (sanText) sanText.textContent = `${sanInt}`;
    const sBar = getHudRef("sanity-bar");
    if (sBar) {
      sBar.style.width = `${sanInt}%`;
      sBar.style.background = sanColor;
    }
  }

  if (hudCache.staminaInt !== stamInt) {
    hudCache.staminaInt = stamInt;
    const stamText = getHudRef("stamina-text");
    const stamBar = getHudRef("stamina-bar");
    if (stamText) stamText.textContent = `${stamInt}%`;
    if (stamBar) stamBar.style.width = `${stamInt}%`;
  }

  if (hudCache.showFlicker !== showFlicker) {
    hudCache.showFlicker = showFlicker;
    const flickerBanner = getHudRef("flicker-banner");
    if (flickerBanner) flickerBanner.style.display = showFlicker ? "block" : "none";
  }

  if (hudCache.showDanger !== showDanger) {
    hudCache.showDanger = showDanger;
    const dangerBanner = getHudRef("danger-banner");
    if (dangerBanner) dangerBanner.style.display = showDanger ? "block" : "none";
  }

  if (hudCache.progress !== progStr) {
    hudCache.progress = progStr;
    const progEl = getHudRef("progress-text");
    if (progEl) progEl.textContent = progStr;
  }

  if (hudCache.endings !== endStr) {
    hudCache.endings = endStr;
    const endEl = getHudRef("ending-tracker");
    if (endEl) endEl.textContent = endStr;
  }

  if (hudCache.props !== propStr || hudCache.allPropsDone !== allPropsDone) {
    hudCache.props = propStr;
    hudCache.allPropsDone = allPropsDone;
    const propEl = getHudRef("prop-tracker");
    if (propEl) {
      propEl.textContent = propStr;
      propEl.classList.toggle("complete", allPropsDone);
    }
  }

  if (hudCache.sedative !== sedCount) {
    hudCache.sedative = sedCount;
    const btnSed = getHudRef("btn-use-sedative");
    if (btnSed) {
      btnSed.textContent = `안정제 [Q] (${sedCount})`;
      btnSed.disabled = sedCount <= 0;
    }
  }

  if (hudCache.reducedMotion !== reduced) {
    hudCache.reducedMotion = reduced;
    const label = `점멸 완화: ${reduced ? "ON" : "OFF"}`;
    const btnHud = getHudRef("btn-motion");
    const btnTitle = getHudRef("btn-title-motion");
    if (btnHud) btnHud.textContent = label;
    if (btnTitle) btnTitle.textContent = label;
  }
}

export function renderInventoryUI(onUseConsumable) {
  const bag = getHudRef("item-bag");
  if (!bag) return;
  const sedCount = state.inventory.sedative || 0;
  const propBonusText = state.flags.allPropsExamined
    ? " · [현장 정밀 조사 8/8 완료: 정신 내성 25% 적용 중]"
    : "";
  bag.innerHTML = `
    <div class="bag-row">
      <div class="bag-info">
        <span class="bag-name">신경안정제 × ${sedCount}</span>
        <span class="bag-desc">복용 시 정신력 +30 회복 (단축키: Q)</span>
      </div>
      <button id="btn-bag-sedative" ${sedCount <= 0 ? "disabled" : ""}>사용</button>
    </div>
    <div class="bag-row">
      <div class="bag-info">
        <span class="bag-name">수사관 현장 수칙</span>
        <span class="bag-desc">단서 조합으로 도출한 [진실]이 잠긴 문과 증언을 엽니다.${propBonusText}</span>
      </div>
    </div>
  `;
  const btn = document.getElementById("btn-bag-sedative");
  if (btn) btn.addEventListener("click", () => onUseConsumable("sedative"));
  markHudDirty();
}

export function isClueInterpreted(clue) {
  if (!clue || !Array.isArray(clue.truthIds)) return false;
  return clue.truthIds.some(tid => state.deduced.includes(tid));
}

export function hasRemainingTruths(clue) {
  if (!clue || !Array.isArray(clue.truthIds)) return false;
  return clue.truthIds.some(tid => !state.deduced.includes(tid));
}

export function getClueDisplayDescription(clue) {
  if (!clue) return "";
  if (clue.id === "car_memo" && state.deduced.includes("combo_past")) {
    return clue.description.replace("□□□", "[[blue:강현우]]");
  }
  return clue.description;
}

export function formatClueInspectionText(clue) {
  if (!clue) return "";
  const desc = getClueDisplayDescription(clue);
  if (!isClueInterpreted(clue)) {
    return `[${clue.name}]
${desc}

• [[mint:추리 질문]]: ${clue.comboHint}`;
  }
  const extraQuestion = hasRemainingTruths(clue)
    ? `
• [[mint:추가 추리 질문]]: ${clue.comboHint}`
    : "";
  return `[${clue.name}]
${desc}

• [[gold:핵심 해석]]: ${clue.importance}${extraQuestion}`;
}

export function renderClueUI(onToggleClue) {
  const list = getHudRef("clue-list");
  const detailBox = getHudRef("clue-detail-box");

  if (list) {
    if (state.collected.length === 0) {
      list.textContent = "수집한 단서가 없습니다.";
    } else {
      list.innerHTML = "";
      state.collected.forEach(id => {
        const c = CLUES.find(item => item.id === id);
        if (!c) return;
        const interpreted = isClueInterpreted(c);
        const chip = document.createElement("div");
        chip.className = "clue-chip"
          + (interpreted ? " interpreted" : "")
          + (state.selectedClues.includes(id) ? " selected" : "");
        chip.textContent = interpreted ? `✔ ${c.name}` : c.name;
        chip.title = interpreted ? `[핵심 해석] ${c.importance}` : `[추리 질문] ${c.comboHint}`;
        chip.addEventListener("click", () => onToggleClue(id));
        list.appendChild(chip);
      });
    }
  }

  if (detailBox) {
    const focusId = state.selectedClues[state.selectedClues.length - 1];
    const focusClue = focusId ? CLUES.find(item => item.id === focusId) : null;
    if (focusClue) {
      detailBox.innerHTML = formatHighlightedDialogue(formatClueInspectionText(focusClue));
    } else if (state.collected.length === 0) {
      detailBox.textContent = "현장에서 단서를 수집한 뒤 클릭하면 상세 기록과 추리 질문을 볼 수 있습니다.";
    } else {
      detailBox.textContent = "단서를 클릭해 추리 질문을 확인하고, 연관된 단서 2개를 선택한 뒤 [단서 조합]을 누르세요.";
    }
  }

  const dedBox = getHudRef("deduction-list");
  if (dedBox) {
    if (state.deduced.length === 0) {
      dedBox.textContent = "아직 조합으로 밝혀낸 진실이 없습니다.";
    } else {
      dedBox.innerHTML = "";
      state.deduced.forEach(did => {
        const d = COMBINATIONS.find(x => x.id === did);
        if (!d) return;
        const item = document.createElement("div");
        item.className = "deduction-item";
        const strong = document.createElement("strong");
        strong.textContent = d.title;
        const br = document.createElement("br");
        const span = document.createElement("span");
        span.textContent = d.summary;
        item.append(strong, br, span);
        dedBox.appendChild(item);
      });
    }
  }
  markHudDirty();
}

/* -------------------------------------------------------------------------
   16비트 픽셀 애니메이션 프롤로그 & 기억 회상 컷신 렌더러
   ------------------------------------------------------------------------- */
export function startSceneAnimation(canvasId, artType) {
  state.sceneAnim.canvasId = canvasId;
  state.sceneAnim.artType = artType;
  state.sceneAnim.timer = 0;
  state.sceneAnim.cues = {};
  drawSceneArt(canvasId, artType, 0);
}

export function stopSceneAnimation() {
  state.sceneAnim.canvasId = null;
  state.sceneAnim.artType = null;
  state.sceneAnim.timer = 0;
  state.sceneAnim.cues = {};
}

export function updateSceneAnimation(dt) {
  if (!state.sceneAnim.canvasId || !state.sceneAnim.artType) return;
  if (state.mode !== GAME_MODE.PROLOGUE && state.mode !== GAME_MODE.FLASHBACK) return;
  state.sceneAnim.timer += dt;
  drawSceneArt(state.sceneAnim.canvasId, state.sceneAnim.artType, state.sceneAnim.timer);
}

function triggerSceneCue(cueKey, fn) {
  if (state.sceneAnim.cues[cueKey]) return;
  state.sceneAnim.cues[cueKey] = true;
  fn();
}

export function drawSceneArt(canvasId, artType, t = 0) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;
  const reduced = Boolean(state.prefs.reducedMotion);

  g.save();
  g.fillStyle = "#080a12";
  g.fillRect(0, 0, W, H);

  if (artType === "apt_night") {
    // 밤하늘 그라데이션 & 반짝이는 별
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#070914");
    sky.addColorStop(1, "#131729");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    const stars = [[18, 16], [32, 34], [122, 42], [156, 52], [24, 62], [164, 18]];
    stars.forEach(([sx, sy], idx) => {
      const twinkle = reduced ? 0.6 : (0.35 + 0.55 * Math.sin(t * 3.2 + idx * 1.7));
      g.fillStyle = `rgba(220, 232, 255, ${twinkle.toFixed(2)})`;
      g.fillRect(sx, sy, 2, 2);
    });

    // 보름달 & 일렁이는 달무리
    const haloR = reduced ? 16 : 15 + Math.sin(t * 2.2) * 2.5;
    g.fillStyle = "rgba(242, 210, 139, 0.14)";
    g.beginPath(); g.arc(146, 25, haloR, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f2d28b";
    g.beginPath(); g.arc(146, 25, 9, 0, Math.PI * 2); g.fill();

    // 흘러가는 밤구름
    const cloudOffset = reduced ? 0 : ((t * 7) % (W + 60)) - 30;
    g.fillStyle = "rgba(32, 39, 61, 0.65)";
    g.fillRect(Math.round(cloudOffset), 20, 34, 6);
    g.fillRect(Math.round(cloudOffset + 6), 17, 20, 4);

    // 은하아파트 본관 & 옥상 안테나 점멸등
    g.fillStyle = "#191e2e";
    g.fillRect(42, 18, 78, 106);
    g.fillStyle = "#111521";
    g.fillRect(54, 10, 16, 8);
    g.fillRect(98, 6, 2, 12);
    const beaconOn = reduced ? true : (Math.floor(t * 2.4) % 2 === 0);
    g.fillStyle = beaconOn ? "#F09BA8" : "#4a1c26";
    g.fillRect(98, 4, 2, 2);

    // 창문 점등/소등 애니메이션 + 맨 위층 1304호 붉은 점멸 & 실루엣
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const wx = 50 + col * 16;
        const wy = 26 + row * 15;
        const is1304 = row === 0 && col === 2;
        if (is1304) {
          const pulse = reduced ? 0.85 : (0.65 + 0.35 * Math.sin(t * 6.5));
          g.fillStyle = `rgba(240, 155, 168, ${pulse.toFixed(2)})`;
          g.fillRect(wx, wy, 10, 8);
          // 창 안쪽을 스치는 검은 그림자
          const shadowShift = reduced ? 3 : Math.round(3 + Math.sin(t * 2.4) * 3);
          g.fillStyle = "#1a080d";
          g.fillRect(wx + shadowShift, wy + 2, 3, 6);
        } else {
          const turnOffTime = 0.35 + ((row * 4 + col) % 7) * 0.24;
          const lit = ((row + col) % 3 === 0) && (t < turnOffTime);
          g.fillStyle = lit ? "#596587" : "#0e111c";
          g.fillRect(wx, wy, 10, 8);
        }
      }
    }
  } else if (artType === "corridor_13") {
    // 13층 복도 원근 배경
    const flickerWave = reduced ? 1 : (Math.sin(t * 19) + Math.cos(t * 31));
    const tubeOn = reduced ? true : flickerWave > -0.35;

    if (!tubeOn && t > 0.3) {
      triggerSceneCue("corridor_flicker", () => playSfx("flicker"));
    }

    g.fillStyle = tubeOn ? "#1d1521" : "#0c0910";
    g.fillRect(0, 0, W, H);

    // 복도 원근선
    g.strokeStyle = tubeOn ? "#5c3e4b" : "#2b1c23";
    g.lineWidth = 1.5;
    g.strokeRect(52, 28, 76, 68);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(52, 28);
    g.moveTo(W, 0); g.lineTo(128, 28);
    g.moveTo(0, H); g.lineTo(52, 96);
    g.moveTo(W, H); g.lineTo(128, 96);
    g.stroke();

    // 천장 형광등
    g.fillStyle = tubeOn ? "#dce8ff" : "#282c38";
    g.fillRect(72, 10, 36, 4);

    // 초록색 EXIT 비상구 유도등
    const exitGlow = reduced ? 0.9 : (0.75 + 0.25 * Math.sin(t * 8));
    g.fillStyle = `rgba(156, 224, 184, ${exitGlow.toFixed(2)})`;
    g.fillRect(79, 19, 22, 7);
    g.fillStyle = "#0b1a12";
    g.font = "bold 6px monospace";
    g.textAlign = "center";
    g.fillText("EXIT", 90, 25);

    // 쓰러진 소년의 미세한 호흡 모션
    const breathY = reduced ? 0 : Math.round(Math.sin(t * 3.0));
    g.fillStyle = tubeOn ? "#293d5c" : "#152030";
    g.fillRect(78, 78 + breathY, 22, 14);
    g.fillStyle = tubeOn ? "#e8bfa5" : "#7d6658";
    g.fillRect(83, 68 + breathY, 12, 10);

    // 벽면의 붉은 긁힌 자국 (조명 깜빡일 때 선명해짐)
    g.fillStyle = tubeOn ? "#F09BA8" : "#6e2c39";
    for (let i = 0; i < 6; i++) {
      g.fillRect(16 + i * 4, 52 + (i % 2) * 2, 2, 18);
    }
    g.textAlign = "left";
  } else if (artType === "knock_door") {
    // 3박자 노크 cycle (3.2초 주기)
    const cycle = t % 3.2;
    const knockTimes = [0.35, 0.72, 1.09];
    let knockPulse = 0;

    knockTimes.forEach((kt, idx) => {
      const diff = cycle - kt;
      if (diff >= 0 && diff < 0.28) {
        knockPulse = Math.max(knockPulse, 1 - diff / 0.28);
        triggerSceneCue(`knock_${idx}`, () => playSfx("knock"));
      }
    });

    const shakeX = (!reduced && knockPulse > 0) ? Math.round((Math.random() - 0.5) * 4 * knockPulse) : 0;
    const shakeY = (!reduced && knockPulse > 0) ? Math.round((Math.random() - 0.5) * 3 * knockPulse) : 0;

    g.save();
    g.translate(shakeX, shakeY);

    // 1304호 철문 & 문틀
    g.fillStyle = "#18131c";
    g.fillRect(58, 12, 64, 102);
    g.fillStyle = "#29212e";
    g.fillRect(62, 16, 56, 96);
    g.strokeStyle = "#F2D28B";
    g.lineWidth = 1.5;
    g.strokeRect(62, 16, 56, 96);

    // 문패 1304 & 손잡이
    g.fillStyle = "#F2D28B";
    g.font = "bold 12px monospace";
    g.textAlign = "center";
    g.fillText("1304", 90, 34);
    g.fillRect(108, 64, 4, 8);

    // 문틈 아래 붉은 빛
    const slitAlpha = 0.35 + knockPulse * 0.55;
    g.fillStyle = `rgba(240, 155, 168, ${slitAlpha.toFixed(2)})`;
    g.fillRect(60, 111, 60, 3);

    // 확산되는 붉은 노크 파동 링
    knockTimes.forEach(kt => {
      const age = cycle - kt;
      if (age >= 0 && age < 1.1) {
        const radius = 8 + age * 34;
        const alpha = Math.max(0, (1 - age / 1.1) * 0.85);
        g.strokeStyle = `rgba(240, 155, 168, ${alpha.toFixed(2)})`;
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(90, 62, radius, 0, Math.PI * 2);
        g.stroke();
      }
    });

    g.restore();
    g.textAlign = "left";
  } else if (artType === "memory_rescue") {
    g.fillStyle = "#1a1624";
    g.fillRect(0, 0, W, H);

    // 비상구 불빛
    const exitPulse = reduced ? 0.9 : (0.75 + 0.25 * Math.sin(t * 5));
    g.fillStyle = `rgba(156, 224, 184, ${exitPulse.toFixed(2)})`;
    g.fillRect(74, 8, 32, 8);

    // 15세 소년 강현우 실루엣
    const bob = reduced ? 0 : Math.round(Math.sin(t * 2.5));
    g.fillStyle = "#2b4263";
    g.fillRect(77, 44 + bob, 26, 24);
    g.fillStyle = "#f2cbb0";
    g.fillRect(81, 25 + bob, 18, 17);
    g.fillStyle = "#161821";
    g.fillRect(80, 22 + bob, 20, 6);

    // 하단 수사 기록 복원 플레이트
    g.fillStyle = "#0f1422";
    g.fillRect(16, 74, 148, 38);
    g.strokeStyle = "#8FC9FF";
    g.lineWidth = 1.5;
    g.strokeRect(16, 74, 148, 38);

    g.font = "bold 9px monospace";
    g.textAlign = "center";
    g.fillStyle = "#9aa3bd";
    g.fillText("1985 생존 소년 [□□□]", 90, 88);

    // 1.1초 동안 글리치 후 [강 현 우 (15세)] 확정
    const revealDone = reduced || t >= 1.1;
    const glitchPool = ["▶ 강 □ 우 (15세)", "▶ □ 현 □ (15세)", "▶ 강 현 □ (15세)", "▶ # % & (15세)"];
    const labelText = revealDone
      ? "▶ 강 현 우 (15세)"
      : glitchPool[Math.floor(t * 16) % glitchPool.length];

    g.fillStyle = revealDone ? "#8FC9FF" : "#F09BA8";
    g.font = "bold 11px monospace";
    g.fillText(labelText, 90, 104);
    g.textAlign = "left";
  } else if (artType === "memory_yoonseo") {
    g.fillStyle = "#181526";
    g.fillRect(0, 0, W, H);

    // 달빛이 비치는 창문 & 흔들리는 커튼
    g.strokeStyle = "#8FC9FF";
    g.lineWidth = 1.5;
    g.strokeRect(52, 16, 76, 80);

    const sway = reduced ? 0 : Math.round(Math.sin(t * 2.2) * 3);
    g.fillStyle = "rgba(143, 201, 255, 0.14)";
    g.fillRect(54, 18, 72, 76);

    // 윤서 실루엣
    const bob = reduced ? 0 : Math.round(Math.sin(t * 2.6));
    g.fillStyle = "#dce3ed";
    g.fillRect(77, 56 + bob, 26, 36);
    g.fillStyle = "#f5e8ea";
    g.fillRect(80, 36 + bob, 20, 19);
    g.fillStyle = "#14131a";
    g.fillRect(77, 29 + bob, 26, 10);

    // 커튼
    g.fillStyle = "#2c344d";
    g.fillRect(53, 17, 12 + sway, 78);
    g.fillRect(115 - sway, 17, 12 + sway, 78);

    g.fillStyle = "#8FC9FF";
    g.font = "bold 10px monospace";
    g.textAlign = "center";
    g.fillText("1304호 · 윤서", 90, 112);
    g.textAlign = "left";
  } else {
    // PROLOGUE 04: detective_arrive (로비 현관문 그림자 & 23:47 정지 시계)
    g.fillStyle = "#141926";
    g.fillRect(0, 0, W, H);

    // 현관문이 닫히며 드리워지는 그림자 슬라이드
    const doorClose = reduced ? 1 : Math.min(1, t / 0.85);
    if (doorClose >= 0.95) {
      triggerSceneCue("lobby_door", () => playSfx("door"));
    }
    g.fillStyle = "rgba(5, 7, 13, 0.72)";
    g.fillRect(0, 0, Math.round(52 * doorClose), H);

    // 강현우 실루엣 & 코트 깃 흔들림
    const coatFlutter = reduced ? 0 : Math.round(Math.sin(t * 4.5));
    g.fillStyle = "#2b4263";
    g.fillRect(70 - coatFlutter, 56, 40 + coatFlutter * 2, 54);
    g.fillStyle = "#8FC9FF";
    g.fillRect(78, 58, 24, 38);
    g.fillStyle = "#f2cbb0";
    g.fillRect(76, 26, 28, 28);
    g.fillStyle = "#161821";
    g.fillRect(74, 18, 32, 12);

    // 로비 벽시계: 23:45 -> 23:46 -> 23:47에서 정지!
    let clockStr = "23:47";
    let stopped = true;
    if (!reduced && t < 1.3) {
      stopped = false;
      if (t < 0.65) {
        clockStr = "23:45";
        triggerSceneCue("tick_1", () => playSfx("clock_tick"));
      } else {
        clockStr = "23:46";
        triggerSceneCue("tick_2", () => playSfx("clock_tick"));
      }
    } else {
      triggerSceneCue("clock_freeze", () => playSfx("clock_stop"));
    }

    g.fillStyle = "#0b0e17";
    g.fillRect(124, 14, 48, 22);
    g.strokeStyle = stopped ? "#F09BA8" : "#F2D28B";
    g.lineWidth = 1.5;
    g.strokeRect(124, 14, 48, 22);

    g.fillStyle = stopped ? "#F09BA8" : "#F2D28B";
    g.font = "bold 11px monospace";
    g.textAlign = "center";
    g.fillText(clockStr, 148, 29);
    g.textAlign = "left";
  }

  // 레트로 CRT 스캔라인 마감
  g.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) {
    g.fillRect(0, y, W, 1);
  }
  g.restore();
}

export function renderTutorialBanner() {
  const banner = getHudRef("tutorial-banner");
  const overlay = getHudRef("dialogue-overlay");
  if (!banner) return;
  if (state.tutorialStep <= 0 || state.tutorialStep > TUTORIAL_STEPS.length || state.flags.tutorialDone) {
    banner.style.display = "none";
    if (overlay && state.dialogueHidden) {
      overlay.style.display = "none";
    }
    return;
  }
  const info = TUTORIAL_STEPS[state.tutorialStep - 1];
  const isLast = state.tutorialStep === TUTORIAL_STEPS.length;
  if (overlay) overlay.style.display = "block";
  banner.style.display = "block";
  banner.innerHTML = `
    <div class="tutorial-header">
      <span>${info.title}</span>
      <span>GUIDE</span>
    </div>
    <div>${formatHighlightedDialogue(info.text)}</div>
    <div class="tutorial-controls">
      <button class="tut-btn" id="btn-tut-skip">가이드 닫기</button>
      <button class="tut-btn" id="btn-tut-next">${isLast ? "확인 ✔" : "다음 ▶"}</button>
    </div>
  `;
}
