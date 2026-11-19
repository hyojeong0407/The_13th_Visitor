/* =========================================================================
   6. UI · 대화창 포트레이트 · dirty-flag HUD 캐시 · Tab 수첩 메뉴 모듈 (v1.4.2)
   ========================================================================= */
import { CLUES, COMBINATIONS, PROPS, TUTORIAL_STEPS } from "./data.js";
import { UI_CONFIG } from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE, setGameMode, clearHeldInputs,
  getUnlockedEndings, markHudDirty
} from "./state.js";
import { playSfx } from "./audio.js";

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

  html = html.replace(/\[\[(gold|blue|red|mint):([^\]]+)\]\]/g, (_, cls, inner) => {
    return `<span class="hl-${cls}">${inner}</span>`;
  });

  const rules = [
    {
      cls: "hl-gold",
      regex: /(1985년 10월 13일|1998년 10월 13일|1999년 10월 13일|11시 47분|23:47|1304호|1303호|1302호|1204호|13층|열세 번째|13번째 방문자|방문자 명부|준공 도면|근무일지|녹음기|가족사진|병원 기록|아이의 일기|찢어진 편지|관리비 고지서|추리 질문|핵심 해석|돋보기 아이콘)/g
    },
    {
      cls: "hl-blue",
      regex: /(강현우|윤서|박만식|한미정|벽장 뒤|숨겨진 방|낡은 거울|거울|\[H\]|\[E\]|\[C\]|\[M\]|\[Q\]|\[Tab\]|\[Space\])/g
    },
    {
      cls: "hl-red",
      regex: /(형광등이 격렬하게 깜빡|형광등이 불규칙하게 점멸|형광등이 심하게 깜빡|형광등이 깜빡이면|형광등이 깜빡거리면|문을 열지 마|정전|원혼|노크 소리|몸을 숨길 곳이 없다|실종|피로 쓴|GAME OVER|BAD END)/g
    },
    {
      cls: "hl-mint",
      regex: /(은신|숨기|캐비닛|대형 장롱|장롱|콘크리트 기둥|기둥|신경안정제|TRUE END|숨을 참)/g
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

export function renderSpeakerPortrait(speakerName) {
  const pCanvas = getHudRef("portrait-canvas");
  const pRole = getHudRef("portrait-role");
  if (!pCanvas || !pRole) return;

  const pctx = pCanvas.getContext("2d");
  const W = pCanvas.width;
  const H = pCanvas.height;
  pctx.clearRect(0, 0, W, H);

  const name = speakerName || "";
  let kind = "system";
  let roleLabel = "SYSTEM";

  if (name.includes("강현우")) { kind = "hero"; roleLabel = "신입 형사"; }
  else if (name.includes("박만식")) { kind = "park"; roleLabel = "경비원"; }
  else if (name.includes("한미정")) { kind = "han"; roleLabel = "1204호 주민"; }
  else if (name.includes("윤서")) { kind = "yoonseo"; roleLabel = "13층의 소녀"; }
  else if (name.includes("방문자") || name.includes("원혼") || name.includes("BAD END") || name.includes("GAME OVER")) {
    kind = "ghost"; roleLabel = "13번째 방문자";
  } else if (name.includes("단서") || name.includes("수첩") || name.includes("진실") || name.includes("TRUE END")) {
    kind = "clue"; roleLabel = "수사 기록";
  }

  pRole.textContent = roleLabel;

  const bg = pctx.createLinearGradient(0, 0, 0, H);
  if (kind === "hero") { bg.addColorStop(0, "#182438"); bg.addColorStop(1, "#0d131f"); }
  else if (kind === "park") { bg.addColorStop(0, "#1c2b28"); bg.addColorStop(1, "#0f1715"); }
  else if (kind === "han") { bg.addColorStop(0, "#2b1d2c"); bg.addColorStop(1, "#140d15"); }
  else if (kind === "yoonseo") { bg.addColorStop(0, "#262333"); bg.addColorStop(1, "#110f17"); }
  else if (kind === "ghost") { bg.addColorStop(0, "#3b1019"); bg.addColorStop(1, "#140508"); }
  else if (kind === "clue") { bg.addColorStop(0, "#2e2618"); bg.addColorStop(1, "#14110b"); }
  else { bg.addColorStop(0, "#1b2030"); bg.addColorStop(1, "#0d1018"); }
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, W, H);

  if (kind === "hero") {
    pctx.fillStyle = "#263b59"; pctx.fillRect(12, 46, 44, 22);
    pctx.fillStyle = "#1b2a40"; pctx.fillRect(26, 46, 16, 22);
    pctx.fillStyle = "#8FC9FF"; pctx.fillRect(29, 47, 10, 14);
    pctx.fillStyle = "#141c2b"; pctx.fillRect(33, 49, 2, 14);
    pctx.fillStyle = "#d9ad91"; pctx.fillRect(29, 40, 10, 7);
    pctx.fillStyle = "#f2cbb0"; pctx.fillRect(21, 18, 26, 24);
    pctx.fillStyle = "#161821";
    pctx.fillRect(19, 11, 30, 10); pctx.fillRect(19, 18, 4, 15); pctx.fillRect(45, 18, 4, 15);
    pctx.fillStyle = "#1a1d26"; pctx.fillRect(24, 26, 6, 2); pctx.fillRect(38, 26, 6, 2);
    pctx.fillStyle = "#0e121c"; pctx.fillRect(26, 29, 3, 4); pctx.fillRect(39, 29, 3, 4);
    pctx.fillStyle = "#b8826c"; pctx.fillRect(31, 37, 6, 2);
  } else if (kind === "park") {
    pctx.fillStyle = "#36524d"; pctx.fillRect(12, 47, 44, 21);
    pctx.fillStyle = "#f2d28b"; pctx.fillRect(15, 48, 8, 3); pctx.fillRect(45, 48, 8, 3);
    pctx.fillStyle = "#e0b89d"; pctx.fillRect(21, 20, 26, 22);
    pctx.fillStyle = "#223330"; pctx.fillRect(18, 11, 32, 9);
    pctx.fillStyle = "#131c1a"; pctx.fillRect(17, 19, 34, 3);
    pctx.fillStyle = "#F2D28B"; pctx.fillRect(32, 14, 4, 4);
    pctx.fillStyle = "#141414"; pctx.fillRect(25, 28, 3, 3); pctx.fillRect(40, 28, 3, 3);
  } else if (kind === "han") {
    pctx.fillStyle = "#6e4b6b"; pctx.fillRect(13, 47, 42, 21);
    pctx.fillStyle = "#f2cbb0"; pctx.fillRect(22, 20, 24, 22);
    pctx.fillStyle = "#291b23"; pctx.fillRect(18, 12, 32, 10); pctx.fillRect(18, 19, 5, 24); pctx.fillRect(45, 19, 5, 24);
    pctx.fillStyle = "#181216"; pctx.fillRect(25, 28, 4, 4); pctx.fillRect(39, 28, 4, 4);
  } else if (kind === "yoonseo") {
    pctx.fillStyle = "#dce3ed"; pctx.fillRect(15, 48, 38, 20);
    pctx.fillStyle = "#f5e8ea"; pctx.fillRect(23, 21, 22, 21);
    pctx.fillStyle = "#14131a"; pctx.fillRect(19, 13, 30, 10); pctx.fillRect(19, 20, 4, 28); pctx.fillRect(45, 20, 4, 28);
    pctx.fillStyle = "#2e1219"; pctx.fillRect(26, 29, 3, 4); pctx.fillRect(39, 29, 3, 4);
  } else if (kind === "ghost") {
    pctx.fillStyle = "rgba(240, 155, 168, 0.22)";
    pctx.beginPath(); pctx.arc(34, 34, 26, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = "#17090d"; pctx.fillRect(16, 14, 36, 48);
    pctx.fillStyle = "#4a1320"; pctx.fillRect(20, 44, 28, 24);
    pctx.fillStyle = "#F09BA8"; pctx.fillRect(24, 28, 6, 4); pctx.fillRect(38, 28, 6, 4);
  } else if (kind === "clue") {
    pctx.fillStyle = "#5c4938"; pctx.fillRect(16, 16, 28, 36);
    pctx.fillStyle = "#F2D28B"; pctx.fillRect(19, 19, 22, 30);
    pctx.fillStyle = "#4a3b2c"; pctx.fillRect(22, 24, 16, 2); pctx.fillRect(22, 29, 14, 2);
  } else {
    pctx.strokeStyle = "#8FC9FF"; pctx.lineWidth = 2; pctx.strokeRect(14, 16, 40, 30);
    pctx.fillStyle = "#F2D28B"; pctx.font = "bold 12px monospace"; pctx.textAlign = "center";
    pctx.fillText("13F", 34, 34);
  }

  pctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) pctx.fillRect(0, y, W, 1);
}

export function say(speaker, text, speakerClass = "c-system", choices = []) {
  const sp = getHudRef("speaker");
  const msg = getHudRef("message");
  const chBox = getHudRef("choices");

  if (sp) {
    sp.textContent = speaker;
    sp.className = speakerClass;
  }
  if (msg) {
    msg.innerHTML = formatHighlightedDialogue(text);
    msg.className = "c-npc";
  }

  renderSpeakerPortrait(speaker);

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
        state.activeChoices = [];
        chBox.innerHTML = "";
        if (state.mode === GAME_MODE.DIALOGUE) setGameMode(GAME_MODE.PLAY);
        ch.action();
      });
      chBox.appendChild(btn);
    });
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
  const propStr = `환경 조사: ${state.examinedProps.length}/${PROPS.length}`;
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

  if (hudCache.props !== propStr) {
    hudCache.props = propStr;
    const propEl = getHudRef("prop-tracker");
    if (propEl) propEl.textContent = propStr;
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
        <span class="bag-desc">가구에 접근해 돋보기가 뜨면 [E]로 조사. 점멸 시 [H]로 숨고 [Space]로 숨을 참으세요.</span>
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

export function getClueDisplayDescription(clue) {
  if (!clue) return "";
  if (clue.id === "car_memo" && state.deduced.includes("combo_past")) {
    return clue.description.replace("□□□", "[[blue:강현우]]");
  }
  return clue.description;
}

export function renderClueUI(onToggleClue) {
  const list = getHudRef("clue-list");
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
        chip.className = "clue-chip" + (state.selectedClues.includes(id) ? " selected" : "");
        chip.textContent = interpreted ? `✔ ${c.name}` : c.name;
        chip.title = interpreted ? `[해석 완료] ${c.importance}` : `[추리 질문] ${c.comboHint}`;
        chip.addEventListener("click", () => onToggleClue(id));
        list.appendChild(chip);
      });
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

export function drawSceneArt(canvasId, artType) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;

  g.fillStyle = "#090b14";
  g.fillRect(0, 0, W, H);

  if (artType === "apt_night") {
    g.fillStyle = "#f2d28b";
    g.beginPath(); g.arc(132, 22, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1d2233"; g.fillRect(36, 16, 68, 94);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const is1304 = row === 0 && col === 2;
        g.fillStyle = is1304 ? "#F09BA8" : ((row + col) % 3 === 0 ? "#4f5975" : "#111420");
        g.fillRect(43 + col * 14, 24 + row * 13, 8, 7);
      }
    }
  } else if (artType === "corridor_13") {
    g.fillStyle = "#1a131c"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#543944"; g.lineWidth = 2; g.strokeRect(48, 24, 64, 62);
    g.fillStyle = "#9ce0b8"; g.fillRect(72, 14, 16, 6);
    g.fillStyle = "#F09BA8";
    for (let i = 0; i < 6; i++) g.fillRect(18 + i * 4, 48, 2, 16);
  } else if (artType === "knock_door") {
    g.fillStyle = "#261f29"; g.fillRect(54, 12, 52, 88);
    g.strokeStyle = "#F2D28B"; g.lineWidth = 1.5; g.strokeRect(54, 12, 52, 88);
    g.fillStyle = "#F2D28B"; g.font = "bold 11px monospace"; g.textAlign = "center";
    g.fillText("1304", 80, 30);
    g.strokeStyle = "#F09BA8";
    [12, 20, 28].forEach(r => { g.beginPath(); g.arc(80, 56, r, 0, Math.PI * 2); g.stroke(); });
  } else if (artType === "memory_rescue") {
    g.fillStyle = "#1c1824"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#9ce0b8"; g.fillRect(66, 12, 28, 8);
    g.fillStyle = "#2b4263"; g.fillRect(68, 56, 24, 32);
    g.fillStyle = "#f2cbb0"; g.fillRect(71, 36, 18, 18);
    g.fillStyle = "#F2D28B"; g.font = "bold 10px monospace"; g.textAlign = "center";
    g.fillText("1985 · 강현우", 80, 102);
  } else if (artType === "memory_yoonseo") {
    g.fillStyle = "#1a1726"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#8FC9FF"; g.strokeRect(46, 18, 68, 74);
    g.fillStyle = "#dce3ed"; g.fillRect(68, 54, 24, 34);
    g.fillStyle = "#f5e8ea"; g.fillRect(71, 35, 18, 18);
    g.fillStyle = "#14131a"; g.fillRect(68, 29, 24, 9);
    g.fillStyle = "#8FC9FF"; g.font = "bold 10px monospace"; g.textAlign = "center";
    g.fillText("1304호 · 윤서", 80, 102);
  } else {
    g.fillStyle = "#161b29"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#2b4263"; g.fillRect(62, 52, 36, 46);
    g.fillStyle = "#8FC9FF"; g.fillRect(68, 54, 24, 34);
    g.fillStyle = "#f2cbb0"; g.fillRect(67, 24, 26, 26);
    g.fillStyle = "#161821"; g.fillRect(65, 16, 30, 12);
    g.fillStyle = "#F2D28B"; g.font = "bold 11px monospace"; g.textAlign = "center";
    g.fillText("23:47", 130, 26);
  }
}

export function renderTutorialBanner() {
  const banner = getHudRef("tutorial-banner");
  if (!banner) return;
  if (state.tutorialStep <= 0 || state.tutorialStep > TUTORIAL_STEPS.length || state.flags.tutorialDone) {
    banner.style.display = "none";
    return;
  }
  const info = TUTORIAL_STEPS[state.tutorialStep - 1];
  const isLast = state.tutorialStep === TUTORIAL_STEPS.length;
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
