/* =========================================================================
   4-2. 현장 조사 · 단서 조합 · 기억 회상 · NPC 대화 엔진 · 엔딩 판정 모듈 (v1.7.0)
   ========================================================================= */
import {
  FLASHBACK_SCENES, CLUES, COMBINATIONS,
  FIELD_ITEMS, PROPS, ROOMS, NPCS
} from "./data.js";
import { NPC_DIALOGUES } from "./dialogueData.js";
import { SANITY_CONFIG, UI_CONFIG } from "./config.js";
import {
  state, GAME_MODE, GHOST_STATE,
  setGameMode, setGhostState, unlockDoor1304, markHudDirty,
  recordEndingUnlock, hasValidSaveData, autoSaveGame
} from "./state.js";
import { playSfx } from "./audio.js";
import { findNearestWalkable, startGhostWarning } from "./ghost.js";
import {
  formatHighlightedDialogue, say, addLog, toggleNotebookDrawer,
  updateHUD, renderInventoryUI, formatClueInspectionText,
  renderClueUI, renderTutorialBanner,
  startTypewriter, isTypewriterActive, finishTypewriter,
  startSceneAnimation, stopSceneAnimation
} from "./ui.js";
import {
  dirToDelta, getFacingTile, handleDoorTransition, openElevatorMenu,
  toggleHide, triggerGhostEventById
} from "./movement.js";

export function changeSanity(
  delta,
  reason = "",
  silent = false,
  gameOverTitle = "정신 붕괴",
  gameOverReason = "끝없는 환청과 공포에 짓눌린 강현우는 결국 13층의 어둠 속에서 자아를 잃고 말았다."
) {
  if (state.mode === GAME_MODE.ENDED) return;
  state.sanity = Math.max(SANITY_CONFIG.MIN, Math.min(SANITY_CONFIG.MAX, state.sanity + delta));
  if (!silent) {
    if (delta < 0) {
      state.screenShake = Math.min(12, Math.abs(delta));
      if (reason) addLog(`정신력 ${delta} (${reason})`);
    } else if (delta > 0 && reason) {
      addLog(`정신력 +${delta} (${reason})`);
    }
  }
  markHudDirty();
  if (state.sanity <= SANITY_CONFIG.MIN) {
    triggerGameOver(gameOverTitle, gameOverReason);
  }
}

export function useConsumable(type) {
  if (state.mode !== GAME_MODE.PLAY) return;
  if (type === "sedative") {
    if ((state.inventory.sedative || 0) <= 0) {
      say("SYSTEM", "보유한 신경안정제가 없습니다.", "c-system");
      return;
    }
    if (state.sanity >= SANITY_CONFIG.MAX) {
      say("강현우", "지금은 정신이 또렷해. 약을 아껴두자.", "c-hero");
      return;
    }
    state.inventory.sedative--;
    changeSanity(SANITY_CONFIG.SEDATIVE_RESTORE, "신경안정제 복용");
    playSfx("item");
    say("강현우", `약을 삼키자 거칠던 호흡이 조금씩 가라앉는다. (정신력 +${SANITY_CONFIG.SEDATIVE_RESTORE})`, "c-hero");
    renderInventoryUI(useConsumable);
  }
}

export function toggleSelectClue(id) {
  if (state.mode !== GAME_MODE.PLAY) return;
  const c = CLUES.find(item => item.id === id);
  if (state.selectedClues.includes(id)) {
    state.selectedClues = state.selectedClues.filter(x => x !== id);
  } else {
    if (state.selectedClues.length >= 2) state.selectedClues.shift();
    state.selectedClues.push(id);
    if (c) {
      say("수사 수첩", formatClueInspectionText(c), "c-clue", [], { instant: true });
    }
  }
  renderClueUI(toggleSelectClue);
}

function applyWrongCombinationPenalty(hooks) {
  state.wrongComboCount = (state.wrongComboCount || 0) + 1;
  const rawPenalty = SANITY_CONFIG.WRONG_COMBO_BASE_PENALTY +
    (state.wrongComboCount - 1) * SANITY_CONFIG.WRONG_COMBO_STEP_PENALTY;
  const penalty = Math.max(SANITY_CONFIG.WRONG_COMBO_MAX_PENALTY, rawPenalty);

  playSfx("bump");
  playSfx("heartbeat");
  changeSanity(penalty, `오답 추리 조합 누적 ${state.wrongComboCount}회`);
  if (state.mode === GAME_MODE.ENDED) return;

  if (state.lightState === "flicker" && state.ghost.state === GHOST_STATE.WARNING) {
    state.flickerTimer = Math.max(0.5, state.flickerTimer - SANITY_CONFIG.WRONG_COMBO_FLICKER_REDUCE);
    addLog("추리 혼란으로 정신이 흔들리며 점멸 유예 시간이 급격히 줄어들었다!");
    say(
      "강현우",
      `머리가 깨질 듯이 울린다... 잘못된 가설에 매달리는 사이 천장 형광등이 더 빠르게 꺼져 간다! (정신력 ${penalty})`,
      "c-ghost"
    );
    return;
  }

  const r = ROOMS[state.currentRoom];
  const canHauntHere = Boolean(
    state.ghost.state === GHOST_STATE.IDLE &&
    state.wrongComboCount >= 2 &&
    r &&
    r.hidingSpots &&
    r.hidingSpots.length > 0
  );

  if (canHauntHere) {
    if (state.notebookOpen) toggleNotebookDrawer(false);
    const spawnPos = findNearestWalkable(state.currentRoom, r.cols - 3, Math.floor(r.rows / 2), NPCS);
    addLog(`반복된 오답 추리(${state.wrongComboCount}회)의 불안에 13번째 방문자가 반응했다!`);
    startGhostWarning(
      state.currentRoom,
      spawnPos.x,
      spawnPos.y,
      `억지 추리로 흐트러진 정신 틈을 타 주변 형광등이 격렬하게 깜빡이기 시작한다! (정신력 ${penalty}) 서둘러 은신처를 찾거나 구역을 벗어나라 [H]!`,
      "형광등이 터지며 암전이 찾아왔다! 흐트러진 정신을 노리고 13번째 방문자가 덮쳐온다!",
      {
        addLog,
        say,
        onTutorial4: () => hooks.startTutorialStep && hooks.startTutorialStep(4)
      }
    );
    return;
  }

  const warningHint = state.wrongComboCount === 1
    ? "다음부터 억지 추리를 반복하면 극심한 정신 소모와 함께 13번째 방문자를 자극할 수 있다."
    : "흐트러진 정신력이 13층의 원념을 끌어당기고 있다!";
  say(
    "강현우",
    `억지로 끼워 맞춘 가설이야... 각 단서의 [[mint:추리 질문]]을 다시 대조해 보자. (정신력 ${penalty})\n${warningHint}`,
    "c-hero"
  );
}

export function combineSelectedClues(hooks) {
  if (state.mode !== GAME_MODE.PLAY) return;
  if (state.selectedClues.length < 2) {
    say("SYSTEM", "수사 수첩에서 서로 연관된 단서 2개를 클릭해 선택한 뒤 조합해 주세요.", "c-system");
    return;
  }
  const [a, b] = state.selectedClues;
  const match = COMBINATIONS.find(c =>
    (c.pair[0] === a && c.pair[1] === b) || (c.pair[0] === b && c.pair[1] === a)
  );

  state.selectedClues = [];
  renderClueUI(toggleSelectClue);

  if (state.tutorialStep === 3) {
    state.tutorialStep = 0;
    renderTutorialBanner();
  }

  if (!match) {
    applyWrongCombinationPenalty(hooks);
    return;
  }

  if (state.deduced.includes(match.id)) {
    say("SYSTEM", `이미 도출한 진실입니다.\n\n${match.title}\n${match.summary}`, "c-system");
    return;
  }

  state.deduced.push(match.id);
  playSfx("combo");

  if (match.id === "combo_space" || match.id === "combo_coverup") {
    unlockDoor1304();
    addLog("13층의 진실을 도출해 굳게 잠긴 1304호 현관문을 열 수 있게 되었다.");
  } else if (match.id === "combo_secret") {
    state.flags.secretOpen = true;
    addLog("진실 도출로 아이 방 벽장 뒤 비밀 통로를 여는 방법을 알아냈다!");
  }

  addLog(`새로운 진실 도출: ${match.title}`);
  renderClueUI(toggleSelectClue);
  autoSaveGame();

  if (state.notebookOpen) toggleNotebookDrawer(false);
  say("진실 해금", `증거 조합 성공! 새로운 진실이 수첩에 기록되었다.\n\n${match.title}\n${match.summary}`, "c-clue");

  if (match.flashbackKey === "yoonseo" && !state.flags.flashbackYoonseoSeen) {
    state.flags.flashbackYoonseoSeen = true;
    triggerMemoryFlashback("yoonseo");
  } else if (match.flashbackKey === "past" && !state.flags.flashbackPastSeen) {
    state.flags.flashbackPastSeen = true;
    triggerMemoryFlashback("past");
  }
}

export function triggerMemoryFlashback(key) {
  const scene = FLASHBACK_SCENES[key];
  if (!scene) return;
  state.pendingFlashbackKey = key;
  setGameMode(GAME_MODE.FLASHBACK);
  playSfx("flashback");
  if (key === "past") playSfx("heartbeat");

  document.getElementById("flashback-chapter").textContent = scene.chapter;
  const badgeEl = document.getElementById("flashback-badge");
  if (badgeEl) badgeEl.textContent = scene.badge || "TRUTH UNLOCKED";

  const bannerEl = document.getElementById("flashback-reveal-banner");
  if (bannerEl) {
    if (scene.revealBanner) {
      bannerEl.innerHTML = formatHighlightedDialogue(scene.revealBanner);
      bannerEl.style.display = "block";
    } else {
      bannerEl.style.display = "none";
    }
  }

  document.getElementById("flashback-title").textContent = scene.title;
  startTypewriter("flashback-text", scene.text, "강현우", UI_CONFIG.PROLOGUE_CHARS_PER_SEC);
  startSceneAnimation("flashback-art-canvas", scene.art);
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "flex";
}

export function closeMemoryFlashback() {
  if (isTypewriterActive("flashback-text")) {
    finishTypewriter();
    return;
  }
  stopSceneAnimation();
  const closedKey = state.pendingFlashbackKey;
  state.pendingFlashbackKey = null;
  const fb = document.getElementById("flashback-overlay");
  if (fb) fb.style.display = "none";
  setGameMode(GAME_MODE.PLAY);
  playSfx("clue");

  if (closedKey === "past") {
    addLog("이름 복원 완료: 수사 메모의 [□□□]가 [강현우]로 해금되었다.");
    say(
      "강현우",
      "......기억났어. 수사 메모의 번진 잉크 속에 가려졌던 이름 [[blue:강현우]], 그게 바로 나였어. 13년 전 그날 밤, 아버지 강 순경과 함께 13층에 올라갔던 15세 소년이 나였어...!",
      "c-hero"
    );
  } else if (closedKey === "yoonseo") {
    say(
      "강현우",
      "윤서는 우리를 해치려는 악령이 아니었어... 광기에 빠진 13번째 방문자를 피해 벽장 뒤에서 구조를 기다리다 멈춘 시간에 갇힌 소녀였어.",
      "c-hero"
    );
  }
}

export function findInteractableAt(tx, ty) {
  const r = ROOMS[state.currentRoom];
  if (!r) return null;

  const door = r.doors.find(d => d.x === tx && d.y === ty && (!d.secret || state.flags.secretOpen));
  if (door) return { type: "door", target: door, x: door.x, y: door.y };

  if (Array.isArray(r.specialTiles)) {
    const special = r.specialTiles.find(st => st.x === tx && st.y === ty);
    if (special) return { type: special.type, x: special.x, y: special.y };
  }

  const npc = NPCS.find(n => n.room === state.currentRoom && n.x === tx && n.y === ty);
  if (npc) return { type: "npc", target: npc, x: npc.x, y: npc.y };

  const clue = CLUES.find(c => c.room === state.currentRoom && !state.collected.includes(c.id) && c.x === tx && c.y === ty);
  if (clue) return { type: "clue", target: clue, x: clue.x, y: clue.y };

  const fItem = FIELD_ITEMS.find(it => it.room === state.currentRoom && !state.pickedFieldItems.includes(it.id) && it.x === tx && it.y === ty);
  if (fItem) return { type: "item", target: fItem, x: fItem.x, y: fItem.y };

  const prop = PROPS.find(p => p.room === state.currentRoom && p.x === tx && p.y === ty);
  if (prop) return { type: "prop", target: prop, x: prop.x, y: prop.y };

  const spot = r.hidingSpots.find(s => s.x === tx && s.y === ty);
  if (spot) return { type: "hiding", target: spot, x: spot.x, y: spot.y };

  const lockedSecret = r.doors.find(d => d.secret && d.x === tx && d.y === ty && !state.flags.secretOpen);
  if (lockedSecret) return { type: "secret_wall", x: lockedSecret.x, y: lockedSecret.y };

  return null;
}

export function getBestInteractTarget() {
  const facing = getFacingTile();
  const frontHit = findInteractableAt(facing.x, facing.y);
  if (frontHit) return frontHit;

  const underHit = findInteractableAt(state.player.x, state.player.y);
  if (underHit && underHit.type !== "door") return underHit;

  for (const d of ["down", "up", "left", "right"]) {
    if (d === state.player.dir) continue;
    const { dx, dy } = dirToDelta(d);
    const sideHit = findInteractableAt(state.player.x + dx, state.player.y + dy);
    if (sideHit && sideHit.type !== "door") return sideHit;
  }
  return null;
}

export function interact(hooks) {
  if (state.mode !== GAME_MODE.PLAY || state.notebookOpen) return;
  if (isTypewriterActive("message")) {
    finishTypewriter();
    return;
  }
  if (state.isHiding) {
    toggleHide();
    return;
  }

  const hit = getBestInteractTarget();
  if (!hit) {
    say("강현우", "주변을 꼼꼼히 살펴보았지만 더 이상 특이한 점은 보이지 않는다.", "c-hero");
    return;
  }

  if (state.tutorialStep === 2 && hooks.advanceTutorialStep) {
    hooks.advanceTutorialStep();
  }

  if (hit.x !== state.player.x || hit.y !== state.player.y) {
    const dx = hit.x - state.player.x;
    const dy = hit.y - state.player.y;
    state.player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  }

  if (hit.type === "door") { handleDoorTransition(hit.target, hooks); return; }
  if (hit.type === "elevator_panel") { openElevatorMenu(hooks); return; }

  if (hit.type === "npc") {
    const opp = { up: "down", down: "up", left: "right", right: "left" };
    hit.target.dir = opp[state.player.dir] || "down";
    talkToNPC(hit.target, hooks);
    return;
  }

  if (hit.type === "clue") {
    const clue = hit.target;
    state.collected.push(clue.id);
    playSfx("clue");
    addLog(`단서 획득: [${clue.name}]`);
    renderClueUI(toggleSelectClue);

    if (state.collected.length === 2 && !state.flags.tutorialStep3Shown && !state.flags.tutorialDone) {
      state.flags.tutorialStep3Shown = true;
      hooks.startTutorialStep && hooks.startTutorialStep(3);
    }

    let extraReaction = "";
    if (clue.id === "car_memo") {
      extraReaction = "\n\n(물에 번져 이름이 지워져 있다... '강 순경의 아들 □□□'... 이상하게 가슴이 조여 온다.)";
    } else if (clue.id === "ledger") {
      extraReaction = "\n\n(방문자 명부 13번째 줄에 내 이름이 적혀 있다... 내가 이곳에 발을 들이기도 전에 어떻게 기록된 거지?)";
    }

    say(
      "중요 단서",
      `[${clue.name}]을(를) 발견했다!\n\n${formatClueInspectionText(clue)}${extraReaction}`,
      "c-clue"
    );

    if (clue.id === "recording" || clue.id === "ledger") {
      changeSanity(-5, "충격적인 진실의 단서");
    }
    autoSaveGame();
    return;
  }

  if (hit.type === "item") {
    const fItem = hit.target;
    state.pickedFieldItems.push(fItem.id);
    state.inventory[fItem.type] = (state.inventory[fItem.type] || 0) + 1;
    playSfx("item");
    addLog(`소지품 획득: [${fItem.name}]`);
    renderInventoryUI(useConsumable);
    autoSaveGame();
    say("SYSTEM", `소지품 [${fItem.name}]을(를) 획득했다!\n\n${fItem.desc}`, "c-system");
    return;
  }

  if (hit.type === "mirror") { triggerFinalMirrorEvent(hooks); return; }

  if (hit.type === "prop") {
    const prop = hit.target;
    const firstTime = !state.examinedProps.includes(prop.id);
    if (firstTime) {
      state.examinedProps.push(prop.id);
      addLog(`현장 조사: [${prop.name}]`);
      if (prop.sanityDelta) changeSanity(prop.sanityDelta, prop.sanityReason);
      if (state.examinedProps.length >= PROPS.length && !state.flags.allPropsExamined) {
        state.flags.allPropsExamined = true;
        changeSanity(SANITY_CONFIG.ALL_PROPS_REWARD, "아파트 전체 현장 정밀 조사 완료 (8/8)");
        addLog(`모든 환경 단서(${PROPS.length}/${PROPS.length})를 조사해 [정신 내성]을 획득했다!`);
        renderInventoryUI(useConsumable);
        markHudDirty();
        say(
          "강현우",
          `[${prop.name}]\n${prop.text}\n\n• [[mint:현장 정밀 조사 완료 (8/8)]]: 아파트 전역의 잔류 흔적을 모두 파악했다. 공포에 흔들리지 않는 [[mint:정신 내성]](정신력 소모 25% 완화)을 얻었으며, 거울의 진실을 마주할 준비가 되었다!`,
          "c-hero"
        );
        return;
      }
    }
    playSfx("step");
    markHudDirty();
    say(prop.speaker, `[${prop.name}]\n${prop.text}`, prop.speakerClass);
    return;
  }

  if (hit.type === "hiding") {
    say("SYSTEM", `[${hit.target.label}]이다. 형광등이 깜빡이면 추격자의 시야 밖에서 [H] 키를 눌러 숨을 수 있다.`, "c-system");
    return;
  }

  if (hit.type === "secret_wall") {
    if (state.deduced.includes("combo_secret")) {
      state.flags.secretOpen = true;
      playSfx("door");
      addLog("벽장 뒤 숨겨진 방의 문을 열었다.");
      say("SYSTEM", "도출해낸 진실을 바탕으로 벽장 뒤편을 밀자, 숨겨진 방으로 이어지는 비밀 문이 열렸다!", "c-system");
    } else {
      say("강현우", "벽장 뒤에서 서늘한 바람이 새어 나와. 먼저 [Tab] 수사 수첩에서 관련 단서들을 조합해 비밀을 밝혀야겠어.", "c-hero");
    }
  }
}

function matchesChoiceConditions(ch) {
  if (ch.requiredCluesAny && !ch.requiredCluesAny.some(cid => state.collected.includes(cid))) {
    return false;
  }
  if (ch.requiredDeduced && !ch.requiredDeduced.every(did => state.deduced.includes(did))) {
    return false;
  }
  if (ch.excludeDeduced && ch.excludeDeduced.some(did => state.deduced.includes(did))) {
    return false;
  }
  if (ch.requiredFlags && !ch.requiredFlags.every(f => Boolean(state.flags[f]))) {
    return false;
  }
  if (ch.excludeFlags && ch.excludeFlags.some(f => Boolean(state.flags[f]))) {
    return false;
  }
  return true;
}

function resolveDialogueReply(ch) {
  let text = ch.reply || "";
  if (ch.tokens) {
    for (const [tokenKey, spec] of Object.entries(ch.tokens)) {
      const ok = !spec.requiredDeduced || spec.requiredDeduced.every(did => state.deduced.includes(did));
      text = text.replace(`{{${tokenKey}}}`, ok ? spec.text : (spec.fallback || ""));
    }
  }
  return text;
}

export function talkToNPC(npc, hooks) {
  const tree = NPC_DIALOGUES[npc.id];
  if (!tree) return;

  const builtChoices = tree.choices
    .filter(matchesChoiceConditions)
    .map(ch => ({
      label: ch.label,
      action: () => {
        if (ch.onceFlag) {
          if (state.flags[ch.onceFlag]) return;
          state.flags[ch.onceFlag] = true;
        }
        if (Array.isArray(ch.setFlags)) {
          ch.setFlags.forEach(f => { state.flags[f] = true; });
        }
        if (ch.unlockDoor1304) {
          unlockDoor1304();
        }
        if (ch.calmGhost) {
          setGhostState(GHOST_STATE.IDLE);
          state.lightState = "on";
        }
        if (ch.logOnce) {
          if (!state.flags[ch.logOnce]) {
            state.flags[ch.logOnce] = true;
            if (ch.logText) addLog(ch.logText);
          }
        } else if (ch.logText) {
          addLog(ch.logText);
        }
        if (typeof ch.sanityDelta === "number") {
          changeSanity(ch.sanityDelta, ch.sanityReason || "");
          if (state.mode === GAME_MODE.ENDED) return;
        }
        if (ch.ghostEventId) {
          triggerGhostEventById(ch.ghostEventId, hooks, {
            warningText: ch.ghostWarningOverride,
            chaseText: ch.ghostChaseOverride
          });
          return;
        }
        if (ch.reply) {
          say(ch.speaker || tree.speaker, resolveDialogueReply(ch), ch.speakerClass || tree.speakerClass);
        }
      }
    }));

  say(tree.speaker, tree.greeting, tree.speakerClass, builtChoices);
}

export function triggerFinalMirrorEvent(hooks) {
  playSfx("knock3");
  const hasRequiredTruths =
    state.deduced.length >= 5 &&
    state.deduced.includes("combo_yoonseo") &&
    state.deduced.includes("combo_past") &&
    state.deduced.includes("combo_trap");

  const hasHumanOrFullSearch =
    state.flags.savedYoonseo ||
    (state.flags.parkConfessed && state.flags.hanTruth) ||
    state.flags.allPropsExamined;

  say(
    "SYSTEM",
    `방 한가운데 놓인 낡은 거울 속에 1985년 10월 13일의 방이 비치고 있다.\n도출 진실: ${state.deduced.length}/${COMBINATIONS.length} · 환경 조사: ${state.examinedProps.length}/${PROPS.length}\n\n등 뒤에서 세 번의 노크 소리가 울린다. 똑. 똑. 똑.\n강현우는 마지막 결정을 내려야 한다.`,
    "c-system",
    [
      {
        label: "[진실 직면] 거울 속 13년 전 그날 밤의 기억과 마주한다",
        action: () => {
          if (hasRequiredTruths && hasHumanOrFullSearch) triggerEnding("TRUE", hooks);
          else if (state.deduced.length >= 2) triggerEnding("NORMAL", hooks);
          else triggerEnding("BAD", hooks);
        }
      },
      {
        label: "[사건 봉인] 도출한 기록만 챙겨 1304호의 문을 닫고 떠난다",
        action: () => triggerEnding(state.deduced.length >= 2 ? "NORMAL" : "BAD", hooks)
      },
      {
        label: "[노크 응답] 문밖에서 들리는 익숙한 목소리를 따라 문을 연다",
        action: () => triggerEnding("BAD", hooks)
      }
    ]
  );
}

export function triggerEnding(type, hooks) {
  setGameMode(GAME_MODE.ENDED);
  state.endingType = type;
  setGhostState(GHOST_STATE.IDLE);
  state.lightState = "on";
  recordEndingUnlock(type);
  updateHUD(true);

  if (type === "TRUE") {
    playSfx("combo");
    addLog("엔딩 달성: [TRUE END - 마지막 방문자와 사라진 가족의 진실]");
    say(
      "TRUE END — 마지막 방문자와 사라진 가족의 진실",
      "거울이 산산조각 나며 봉인되어 있던 13년 전의 기억이 완전히 되살아났다.\n\n1985년 10월 13일, 아버지의 광기 속에서 윤서를 구하려다 비상구 앞에 쓰러졌던 소년이 바로 강현우 자신이었다. 윤서는 악령이 아니라, 자신을 기억해 줄 마지막 방문자를 13년 동안 기다려 온 소녀였다.\n\n강현우가 윤서의 이름을 부르며 진실을 세상에 밝히겠다고 맹세하자, 13층의 붉은 어둠이 걷히고 방문자 명부의 마지막 줄이 사라졌다.",
      "c-clue",
      [
        { label: "처음부터 다시 플레이하기", action: () => hooks.startNewGameWithConfirm(true, false) },
        { label: "타이틀 화면으로 이동", action: hooks.returnToTitle }
      ]
    );
  } else if (type === "NORMAL") {
    playSfx("door");
    addLog("엔딩 달성: [NORMAL END - 봉인된 미제 사건]");
    say(
      "NORMAL END — 봉인된 미제 사건",
      "강현우는 밝혀낸 일부 진실만을 토대로 1304호 일가족 실종 사건의 수사 보고서를 제출했다.\n\n사건은 서류상 해결되었지만, 윤서의 진실과 강현우 자신의 잃어버린 기억은 끝내 온전히 밝혀지지 않았다. 1년 뒤인 1999년 10월 13일 밤 11시 47분, 현관문 앞에서 다시 세 번의 노크 소리가 들려왔다.",
      "c-system",
      [
        { label: "모든 진실을 밝히기 위해 다시 도전하기", action: () => hooks.startNewGameWithConfirm(false, false) },
        { label: "타이틀 화면으로 이동", action: hooks.returnToTitle }
      ]
    );
  } else {
    playSfx("ghost");
    addLog("엔딩 달성: [BAD END - 13번째 방문자]");
    say(
      "BAD END — 13번째 방문자",
      "진실을 깨닫지 못한 채 문을 연 순간, 등 뒤의 복도가 어둠 속으로 사라졌다.\n\n방문자 명부의 13번째 칸에 적힌 '강현우'라는 이름이 붉게 물든다. 이제 강현우는 다음 형사가 찾아올 때까지 존재하지 않는 13층 복도를 배회하는 13번째 방문자가 되었다.",
      "c-ghost",
      [
        { label: "처음부터 다시 플레이하기", action: () => hooks.startNewGameWithConfirm(false, false) },
        { label: "타이틀 화면으로 이동", action: hooks.returnToTitle }
      ]
    );
  }
}

export function triggerGameOver(title, reason, hooks = null) {
  if (state.mode === GAME_MODE.ENDED) return;
  setGameMode(GAME_MODE.ENDED);
  state.endingType = null;
  setGhostState(GHOST_STATE.IDLE);
  playSfx("ghost");
  updateHUD(true);
  addLog(`GAME OVER - ${title}`);

  const choices = [];
  if (hasValidSaveData() && hooks?.loadGame) {
    choices.push({ label: "마지막 저장 불러오기", action: hooks.loadGame });
  }
  if (hooks?.startNewGameWithConfirm) {
    choices.push({ label: "새 게임 시작", action: () => hooks.startNewGameWithConfirm(false, false) });
  }
  if (hooks?.returnToTitle) {
    choices.push({ label: "타이틀 화면으로 이동", action: hooks.returnToTitle });
  }

  say(`GAME OVER — ${title}`, `${reason}\n\n은하아파트 13층의 기록에는 또 한 명의 실종자가 추가되었다.`, "c-ghost", choices);
}
