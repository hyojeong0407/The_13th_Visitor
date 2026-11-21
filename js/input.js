/* =========================================================================
   4-3. 통합 입력 라우터 & UI 이벤트 바인딩 모듈 (v1.7.0)
   - Space 주 액션 키 통합 (조사/대화, 대사 타자기 스킵, 프롤로그/회상 진행, 은신 숨 참기)
   ========================================================================= */
import {
  state, GAME_MODE, setGameMode, setReducedMotion, clearHeldInputs
} from "./state.js";
import { initAudio, toggleSound, playSfx } from "./audio.js";
import { holdBreathAction } from "./ghost.js";
import {
  toggleNotebookDrawer, updateHUD, isTypewriterActive, finishTypewriter
} from "./ui.js";
import { toggleHide } from "./movement.js";
import {
  interact, combineSelectedClues, useConsumable, closeMemoryFlashback
} from "./investigation.js";

export function bindAllInputs(hooks) {
  document.getElementById("btn-title-new")?.addEventListener("click", () => {
    initAudio();
    hooks.startNewGameWithConfirm(true, true);
  });

  document.getElementById("btn-title-load")?.addEventListener("click", () => {
    initAudio();
    const ov = document.getElementById("title-overlay");
    if (ov) ov.style.display = "none";
    hooks.loadGame();
  });

  document.getElementById("btn-title-gallery")?.addEventListener("click", hooks.openEndingGallery);
  document.getElementById("btn-prologue-skip")?.addEventListener("click", hooks.finishPrologue);
  document.getElementById("btn-prologue-next")?.addEventListener("click", hooks.advancePrologue);
  document.getElementById("btn-flashback-close")?.addEventListener("click", closeMemoryFlashback);

  document.getElementById("btn-notebook")?.addEventListener("click", () => toggleNotebookDrawer());
  document.getElementById("btn-drawer-close")?.addEventListener("click", () => toggleNotebookDrawer(false));

  document.getElementById("btn-act-interact")?.addEventListener("click", () => {
    initAudio();
    if (state.isHiding && state.breathHold.active) {
      holdBreathAction();
    } else {
      interact(hooks);
    }
  });
  document.getElementById("btn-act-hide")?.addEventListener("click", () => { initAudio(); toggleHide(); });
  document.getElementById("btn-combine")?.addEventListener("click", () => { initAudio(); combineSelectedClues(hooks); });
  document.getElementById("btn-use-sedative")?.addEventListener("click", () => { initAudio(); useConsumable("sedative"); });

  document.getElementById("btn-minimap")?.addEventListener("click", () => {
    state.showMinimap = !state.showMinimap;
    const btn = document.getElementById("btn-minimap");
    if (btn) btn.textContent = `미니맵: ${state.showMinimap ? "ON" : "OFF"}`;
    playSfx("switch");
  });

  document.getElementById("btn-sound")?.addEventListener("click", () => {
    const enabled = toggleSound();
    const btn = document.getElementById("btn-sound");
    if (btn) btn.textContent = `사운드: ${enabled ? "ON" : "OFF"}`;
  });

  const handleToggleMotion = () => {
    setReducedMotion(!state.prefs.reducedMotion);
    updateHUD(true);
    playSfx("switch");
  };
  document.getElementById("btn-motion")?.addEventListener("click", handleToggleMotion);
  document.getElementById("btn-title-motion")?.addEventListener("click", handleToggleMotion);

  document.getElementById("btn-save")?.addEventListener("click", hooks.saveGame);
  document.getElementById("btn-load")?.addEventListener("click", hooks.loadGame);
  document.getElementById("btn-title")?.addEventListener("click", hooks.returnToTitle);

  window.addEventListener("blur", clearHeldInputs);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearHeldInputs();
  });

  const isPrimaryActionKey = code => code === "Space" || code === "KeyE";

  document.addEventListener("keydown", e => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

    if (e.code === "Tab") {
      e.preventDefault();
      if (state.mode === GAME_MODE.PLAY) toggleNotebookDrawer();
      return;
    }

    if (e.code === "Escape") {
      if (state.notebookOpen) { e.preventDefault(); toggleNotebookDrawer(false); return; }
      if (state.mode === GAME_MODE.PROLOGUE) { e.preventDefault(); hooks.finishPrologue(); return; }
      if (state.mode === GAME_MODE.FLASHBACK) { e.preventDefault(); closeMemoryFlashback(); return; }
    }

    if (state.mode === GAME_MODE.PROLOGUE) {
      if (isPrimaryActionKey(e.code) || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) hooks.advancePrologue();
      }
      return;
    }

    if (state.mode === GAME_MODE.FLASHBACK) {
      if (isPrimaryActionKey(e.code) || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) closeMemoryFlashback();
      }
      return;
    }

    if ((state.mode === GAME_MODE.DIALOGUE || state.mode === GAME_MODE.ENDED) && state.activeChoices.length > 0) {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < state.activeChoices.length) {
        e.preventDefault();
        finishTypewriter();
        const chosen = state.activeChoices[idx];
        state.activeChoices = [];
        const chBox = document.getElementById("choices");
        if (chBox) chBox.innerHTML = "";
        if (state.mode === GAME_MODE.DIALOGUE) setGameMode(GAME_MODE.PLAY);
        chosen.action();
      } else if ((isPrimaryActionKey(e.code) || e.code === "Enter") && isTypewriterActive("message")) {
        e.preventDefault();
        finishTypewriter();
      }
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    initAudio();
    state.keys[e.code] = true;

    // 은신 중 숨 참기 미니게임은 Space(및 보조 E) 통합 액션으로 처리
    if (isPrimaryActionKey(e.code) && state.isHiding && state.breathHold.active) {
      if (!e.repeat) holdBreathAction();
      return;
    }

    if (e.repeat) return;

    if (e.code === "KeyC") {
      if (state.notebookOpen) combineSelectedClues(hooks);
      else toggleNotebookDrawer(true);
    } else if (!state.notebookOpen && isPrimaryActionKey(e.code)) {
      interact(hooks);
    } else if (!state.notebookOpen && e.code === "KeyH") {
      toggleHide();
    } else if (e.code === "KeyQ") {
      useConsumable("sedative");
    } else if (e.code === "KeyM") {
      state.showMinimap = !state.showMinimap;
      const btn = document.getElementById("btn-minimap");
      if (btn) btn.textContent = `미니맵: ${state.showMinimap ? "ON" : "OFF"}`;
      playSfx("switch");
    }
  });

  document.addEventListener("keyup", e => {
    state.keys[e.code] = false;
  });

  document.querySelectorAll(".dpad button[data-pad]").forEach(btn => {
    const dir = btn.getAttribute("data-pad");
    const press = e => {
      if (e.cancelable) e.preventDefault();
      initAudio();
      state.padKeys[dir] = true;
    };
    const release = e => {
      if (e.cancelable) e.preventDefault();
      state.padKeys[dir] = false;
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  });
}
