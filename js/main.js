/* =========================================================================
   7. 메인 진입점 (게임 루프, 타이틀 · 프롤로그 · 튜토리얼 · 세이브/로드 생명주기)
   v1.7.0
   ========================================================================= */
import { APP_VERSION } from "../version.js";
import { PROLOGUE_SCENES, NPCS } from "./data.js";
import { SANITY_CONFIG, UI_CONFIG } from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE,
  setGameMode, setGhostState,
  getUnlockedEndings, hasValidSaveData,
  buildSavePayload, applyLoadedData, resetStateFields
} from "./state.js";
import { safeGet, safeSet, isStorageRestricted } from "./storage.js";
import { playSfx, updateFluorescentHum, stopFluorescentHum } from "./audio.js";
import {
  findNearestWalkable, updateHallucinations, updateLightingAndGhost
} from "./ghost.js";
import { updateVisualTimers, renderGame } from "./render.js";
import {
  say, addLog, toggleNotebookDrawer,
  updateHUD, renderInventoryUI,
  renderClueUI, renderTutorialBanner,
  startTypewriter, isTypewriterActive, finishTypewriter, updateTypewriter,
  startSceneAnimation, stopSceneAnimation, updateSceneAnimation,
  updatePortraitAnimation
} from "./ui.js";
import { snapCamera, updateCamera, updatePlayerMovement } from "./movement.js";
import {
  changeSanity, useConsumable, toggleSelectClue,
  getBestInteractTarget, triggerGameOver
} from "./investigation.js";
import { bindAllInputs } from "./input.js";

const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

document.title = `13번째 방문자 (The 13th Visitor) v${APP_VERSION}`;
document.querySelectorAll("[data-app-version]").forEach(el => {
  el.textContent = `v${APP_VERSION}`;
});

function markTutorialStepShown(stepNum) {
  if (stepNum >= 1 && stepNum <= 4) {
    state.flags[`tutorialStep${stepNum}Shown`] = true;
  }
}

function startTutorialStep(stepNum) {
  if (state.flags.tutorialDone) return;
  if (stepNum >= 3 && state.flags[`tutorialStep${stepNum}Shown`]) return;
  markTutorialStepShown(stepNum);
  state.tutorialStep = stepNum;
  renderTutorialBanner();
  bindTutorialButtons();
}

function bindTutorialButtons() {
  const skipBtn = document.getElementById("btn-tut-skip");
  const nextBtn = document.getElementById("btn-tut-next");
  if (skipBtn) skipBtn.onclick = skipTutorial;
  if (nextBtn) nextBtn.onclick = advanceTutorialStep;
}

function advanceTutorialStep() {
  if (state.tutorialStep <= 0) return;
  playSfx("switch");
  if (state.tutorialStep < 4) {
    state.tutorialStep += 1;
    markTutorialStepShown(state.tutorialStep);
    renderTutorialBanner();
    bindTutorialButtons();
  } else {
    state.tutorialStep = 0;
    state.flags.tutorialDone = true;
    renderTutorialBanner();
  }
}

function completeTutorialStep(stepNum) {
  if (state.tutorialStep !== stepNum) return;
  markTutorialStepShown(stepNum);
  if (stepNum === 1) {
    startTutorialStep(2);
  } else {
    state.tutorialStep = 0;
    renderTutorialBanner();
  }
}

function skipTutorial() {
  state.tutorialStep = 0;
  state.flags.tutorialDone = true;
  renderTutorialBanner();
}

function startPrologue() {
  setGameMode(GAME_MODE.PROLOGUE);
  state.prologueIndex = 0;
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "flex";
  renderPrologueScene();
}

function renderPrologueScene() {
  const scene = PROLOGUE_SCENES[state.prologueIndex];
  if (!scene) { finishPrologue(); return; }
  playSfx("step");
  document.getElementById("prologue-chapter").textContent = scene.chapter;
  document.getElementById("prologue-page").textContent = `${state.prologueIndex + 1} / ${PROLOGUE_SCENES.length}`;
  document.getElementById("prologue-title").textContent = scene.title;
  document.getElementById("btn-prologue-next").textContent =
    state.prologueIndex === PROLOGUE_SCENES.length - 1 ? "수사 시작 ▶ [Space]" : "다음 ▶ [Space]";
  startTypewriter("prologue-text", scene.text, "SYSTEM", UI_CONFIG.PROLOGUE_CHARS_PER_SEC);
  startSceneAnimation("prologue-art-canvas", scene.art);
}

function advancePrologue() {
  if (state.mode !== GAME_MODE.PROLOGUE) return;
  if (isTypewriterActive("prologue-text")) {
    finishTypewriter();
    return;
  }
  state.prologueIndex++;
  if (state.prologueIndex >= PROLOGUE_SCENES.length) finishPrologue();
  else renderPrologueScene();
}

function finishPrologue() {
  finishTypewriter();
  stopSceneAnimation();
  setGameMode(GAME_MODE.PLAY);
  const ov = document.getElementById("prologue-overlay");
  if (ov) ov.style.display = "none";
  playSfx("door");
  startTutorialStep(1);
}

function refreshTitleScreen() {
  const preview = document.getElementById("save-preview");
  const loadBtn = document.getElementById("btn-title-load");
  const raw = safeGet("visitorSave");
  const unlocked = getUnlockedEndings();
  const storageNotice = isStorageRestricted() ? " · (브라우저 저장 제한: 임시 메모리 모드)" : "";

  if (!raw) {
    if (preview) preview.textContent = `저장된 데이터 없음 · 달성 엔딩: ${unlocked.length}/3${storageNotice}`;
    if (loadBtn) loadBtn.disabled = true;
  } else {
    try {
      const data = JSON.parse(raw);
      const rName = data.currentRoom || data.room || "1층 복도";
      const cCount = Array.isArray(data.collected) ? data.collected.length : 0;
      const dCount = Array.isArray(data.deduced) ? data.deduced.length : 0;
      const savedAt = data.savedAt ? ` (${data.savedAt})` : "";
      if (preview) preview.textContent = `저장 기록: [${rName}] 단서 ${cCount}개 · 진실 ${dCount}개${savedAt} · 엔딩: ${unlocked.length}/3${storageNotice}`;
      if (loadBtn) loadBtn.disabled = false;
    } catch (e) {
      if (preview) preview.textContent = "저장 데이터를 읽을 수 없습니다.";
      if (loadBtn) loadBtn.disabled = true;
    }
  }
}

function saveGame() {
  if (state.mode === GAME_MODE.ENDED) {
    say("SYSTEM", "이미 엔딩 또는 게임 오버에 도달한 상태입니다.", "c-system");
    return;
  }
  if (state.ghost.state !== GHOST_STATE.IDLE) {
    playSfx("bump");
    say("SYSTEM", "형광등이 점멸하거나 13번째 방문자가 쫓아오는 위기 상황 중에는 저장할 수 없습니다!", "c-ghost");
    return;
  }
  const data = buildSavePayload();
  const persisted = safeSet("visitorSave", JSON.stringify(data));
  playSfx("clue");
  if (persisted) {
    addLog(`현재 수사 진행 상황을 저장했다. (${data.savedAt})`);
    say("SYSTEM", `수사 진행 상황이 안전하게 저장되었습니다. (${data.savedAt})`, "c-system");
  } else {
    addLog(`브라우저 저장소 제한으로 현재 세션 메모리에 임시 저장했다. (${data.savedAt})`);
    say("SYSTEM", `브라우저 저장소가 제한되어 현재 탭의 임시 메모리에 저장되었습니다. (${data.savedAt})`, "c-system");
  }
}

function loadGame() {
  const raw = safeGet("visitorSave");
  if (!raw) {
    say("SYSTEM", "저장된 데이터가 없습니다. 새 게임을 시작해 주세요.", "c-system");
    return;
  }
  try {
    const data = JSON.parse(raw);
    applyLoadedData(
      data,
      (room, x, y) => findNearestWalkable(room, x, y, NPCS),
      () => snapCamera(canvas)
    );
    renderTutorialBanner();
    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";

    renderInventoryUI(useConsumable);
    renderClueUI(toggleSelectClue);
    updateHUD(true);
    addLog("저장된 데이터를 불러왔다.");
    say("SYSTEM", "저장된 수사 기록을 성공적으로 불러왔습니다.", "c-system");
  } catch (e) {
    say("SYSTEM", "저장 데이터를 읽는 중 오류가 발생했습니다.", "c-system");
  }
}

function startNewGameWithConfirm(withPrologue = false, hideTitleOverlay = false) {
  if (hasValidSaveData()) {
    const ok = window.confirm("기존 저장 데이터가 있습니다. 새 게임을 시작하시겠습니까?\n(방 이동이나 단서 획득 시 기존 저장 데이터가 덮어씌워집니다.)");
    if (!ok) return false;
  }
  if (hideTitleOverlay) {
    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";
  }
  resetGame(withPrologue);
  return true;
}

function resetGame(withPrologue = false) {
  stopFluorescentHum();
  resetStateFields(() => snapCamera(canvas));
  renderTutorialBanner();
  const logEl = document.getElementById("event-log");
  if (logEl) logEl.innerHTML = "";
  renderInventoryUI(useConsumable);
  renderClueUI(toggleSelectClue);
  updateHUD(true);
  addLog("1998년 10월 13일 23:47, 은하아파트 수사를 시작했다.");
  say("강현우", "여기가 은하아파트 1층 복도인가... 가구와 주변 사물에 가까이 다가가 돋보기가 뜨면 [Space]로 조사해 보자.", "c-hero");
  if (withPrologue) startPrologue();
}

function returnToTitle() {
  finishTypewriter();
  stopSceneAnimation();
  stopFluorescentHum();
  setGameMode(GAME_MODE.TITLE);
  state.activeChoices = [];
  state.pendingFlashbackKey = null;
  toggleNotebookDrawer(false);
  const pov = document.getElementById("prologue-overlay");
  if (pov) pov.style.display = "none";
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = "on";
  refreshTitleScreen();
  updateHUD(true);
  const ov = document.getElementById("title-overlay");
  if (ov) ov.style.display = "flex";
}

function openEndingGallery() {
  const box = document.getElementById("ending-gallery-box");
  if (!box) return;
  if (box.style.display === "block") { box.style.display = "none"; return; }
  const unlocked = getUnlockedEndings();
  const defs = [
    {
      key: "TRUE",
      title: "TRUE END — 마지막 방문자와 사라진 가족의 진실",
      hint: "조건: 핵심 진실 5개 이상 도출(윤서의 정체·잃어버린 기억·방문자의 법칙 필수) + 인물과 진실 공유 또는 환경 조사 8/8 완료 후 [진실 직면] 선택"
    },
    {
      key: "NORMAL",
      title: "NORMAL END — 봉인된 미제 사건",
      hint: "조건: 진실 2개 이상 도출 후 [사건 봉인]을 선택하거나, TRUE 조건 미달 상태로 [진실 직면] 선택"
    },
    {
      key: "BAD",
      title: "BAD END — 13번째 방문자",
      hint: "조건: 진실이 불충분한 상태(2개 미만)에서 거울을 마주하거나, 문밖 노크 소리에 속아 [노크 응답] 선택"
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

const runtimeHooks = {
  canvas,
  changeSanity,
  startTutorialStep,
  advanceTutorialStep,
  completeTutorialStep,
  startNewGameWithConfirm,
  returnToTitle,
  loadGame,
  saveGame,
  openEndingGallery,
  advancePrologue,
  finishPrologue
};

let lastTime = performance.now();

function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  updateVisualTimers(dt);
  updateTypewriter(dt);
  updateSceneAnimation(dt);
  updatePortraitAnimation(dt);
  updateFluorescentHum(dt, state.lightState === "flicker", state.currentLightOn);

  if (state.mode === GAME_MODE.PLAY) {
    updatePlayerMovement(dt, runtimeHooks);
    updateCamera(dt, canvas);
    updateHallucinations(dt, { addLog });

    if (state.lightState === "out" && !state.isHiding) {
      const drainMult = state.flags.allPropsExamined ? SANITY_CONFIG.ALL_PROPS_DRAIN_MULTIPLIER : 1.0;
      changeSanity(
        -SANITY_CONFIG.DARK_DRAIN_PER_SEC * drainMult * dt,
        "",
        true,
        "어둠 속의 공황",
        "칠흑 같은 정전 속에서 버티지 못한 강현우는 끝내 정신을 잃고 말았다."
      );
    }

    updateLightingAndGhost(dt, NPCS, {
      addLog,
      say,
      changeSanity,
      triggerGameOver: (title, reason) => triggerGameOver(title, reason, runtimeHooks),
      onTutorial4: () => startTutorialStep(4)
    });
    updateHUD();
  }

  renderGame(ctx, canvas, getBestInteractTarget);
  requestAnimationFrame(gameLoop);
}

refreshTitleScreen();
updateHUD(true);
bindAllInputs(runtimeHooks);
requestAnimationFrame(gameLoop);
