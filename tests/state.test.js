import { describe, it, expect, beforeEach } from "vitest";
import {
  state,
  GAME_MODE,
  GHOST_STATE,
  setGameMode,
  setGhostState,
  isDoor1304Unlocked,
  unlockDoor1304,
  migrateSaveData,
  applyLoadedData
} from "../js/state.js";
import { findNearestWalkable } from "../js/ghost.js";

describe("상태 머신(FSM) 및 세이브 데이터 무결성 검증", () => {
  beforeEach(() => {
    state.mode = GAME_MODE.PLAY;
    state.currentRoom = "1층 복도";
    state.deduced = [];
    state.flags = {};
    state.keys = { KeyW: true, Space: true };
    state.padKeys = { up: true, down: false, left: false, right: false };
    setGhostState(GHOST_STATE.IDLE);
  });

  it("PLAY 외 모드로 전환 시 잔류 입력(keys, padKeys)이 자동으로 초기화되어야 한다", () => {
    setGameMode(GAME_MODE.DIALOGUE);
    expect(state.mode).toBe(GAME_MODE.DIALOGUE);
    expect(state.keys.KeyW).toBe(false);
    expect(state.keys.Space).toBe(false);
    expect(state.padKeys.up).toBe(false);
  });

  it("1304호 잠금 해제는 단서 조합 또는 플래그로 정확히 판정되어야 한다", () => {
    expect(isDoor1304Unlocked()).toBe(false);
    state.deduced = ["combo_space"];
    expect(isDoor1304Unlocked()).toBe(true);

    state.deduced = [];
    expect(isDoor1304Unlocked()).toBe(false);
    unlockDoor1304();
    expect(isDoor1304Unlocked()).toBe(true);
  });

  it("구버전 방 이름 세이브 데이터를 현재 방 이름으로 마이그레이션해야 한다", () => {
    expect(migrateSaveData({ currentRoom: "거실" }).currentRoom).toBe("1304호 거실");
    expect(migrateSaveData({ currentRoom: "숨겨진 방" }).currentRoom).toBe("1304호 숨겨진 방");
    expect(migrateSaveData({ currentRoom: "존재하지않는방" }).currentRoom).toBe("1층 복도");
  });

  it("세이브 로드 시 유효하지 않은 ID를 필터링하고 수치를 안전 범위로 보정해야 한다", () => {
    applyLoadedData(
      {
        currentRoom: "1304호 거실",
        player: { x: 0, y: 0, dir: "invalid_dir" },
        sanity: 999,
        stamina: -50,
        collected: ["clue_ledger", "fake_hacked_clue", "clue_ledger"],
        deduced: ["combo_space", "invalid_combo"],
        pickedFieldItems: ["sedative_lobby", "unknown_item"],
        examinedProps: ["prop_mailbox", "unknown_prop"],
        inventory: { sedative: -3 }
      },
      findNearestWalkable,
      () => {}
    );

    expect(state.currentRoom).toBe("1304호 거실");
    expect(state.player.dir).toBe("down");
    expect(state.player.x).toBeGreaterThanOrEqual(1);
    expect(state.player.y).toBeGreaterThanOrEqual(1);
    expect(state.sanity).toBe(100);
    expect(state.stamina).toBe(0);
    expect(state.collected).toEqual(["clue_ledger"]);
    expect(state.deduced).toEqual(["combo_space"]);
    expect(state.pickedFieldItems).toEqual(["sedative_lobby"]);
    expect(state.examinedProps).toEqual(["prop_mailbox"]);
    expect(state.inventory.sedative).toBe(0);
  });
});
