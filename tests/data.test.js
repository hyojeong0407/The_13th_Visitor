import { describe, it, expect } from "vitest";
import { APP_VERSION } from "../version.js";
import {
  CLUES,
  COMBINATIONS,
  FIELD_ITEMS,
  PROPS,
  ROOMS,
  ELEVATOR_DESTINATIONS,
  GHOST_EVENTS,
  NPCS
} from "../js/data.js";
import { NPC_DIALOGUES } from "../js/dialogueData.js";

describe("게임 데이터 무결성 검증 (v1.10.0)", () => {
  it("단일 버전 상수가 1.8.0으로 설정되어 있어야 한다", () => {
    expect(APP_VERSION).toBe("1.10.0");
  });

  it("단서(CLUES) 12종과 추리 조합(COMBINATIONS) 7종의 참조가 모두 유효해야 한다", () => {
    expect(CLUES.length).toBe(12);
    expect(COMBINATIONS.length).toBe(7);

    const clueIds = new Set(CLUES.map(c => c.id));
    expect(clueIds.size).toBe(CLUES.length);

    for (const c of CLUES) {
      expect(Array.isArray(c.questions)).toBe(true);
      expect(c.questions.length).toBeGreaterThan(0);
    }

    const comboIds = new Set();
    for (const combo of COMBINATIONS) {
      expect(comboIds.has(combo.id)).toBe(false);
      comboIds.add(combo.id);
      expect(combo.pair).toHaveLength(2);
      expect(clueIds.has(combo.pair[0])).toBe(true);
      expect(clueIds.has(combo.pair[1])).toBe(true);
      expect(typeof combo.unlockFlag).toBe("string");
    }
  });

  it("모든 방(ROOMS)의 문(doors)과 숨김처(hidingSpots) 좌표가 유효해야 한다", () => {
    const roomNames = Object.keys(ROOMS);
    expect(roomNames.length).toBeGreaterThanOrEqual(8);

    const hidingIds = new Set();
    for (const [roomName, room] of Object.entries(ROOMS)) {
      for (const door of room.doors) {
        expect(door.x).toBeGreaterThanOrEqual(1);
        expect(door.x).toBeLessThanOrEqual(room.cols - 2);
        expect(door.y).toBeGreaterThanOrEqual(1);
        expect(door.y).toBeLessThanOrEqual(room.rows - 2);
        if (door.toRoom !== "ELEVATOR") {
          expect(ROOMS[door.toRoom]).toBeDefined();
          const dest = ROOMS[door.toRoom];
          expect(door.toX).toBeGreaterThanOrEqual(1);
          expect(door.toX).toBeLessThanOrEqual(dest.cols - 2);
          expect(door.toY).toBeGreaterThanOrEqual(1);
          expect(door.toY).toBeLessThanOrEqual(dest.rows - 2);
        }
      }

      for (const spot of room.hidingSpots) {
        expect(hidingIds.has(spot.id)).toBe(false);
        hidingIds.add(spot.id);
        expect(spot.x).toBeGreaterThanOrEqual(1);
        expect(spot.x).toBeLessThanOrEqual(room.cols - 2);
        expect(spot.y).toBeGreaterThanOrEqual(1);
        expect(spot.y).toBeLessThanOrEqual(room.rows - 2);
      }
    }

    for (const item of FIELD_ITEMS) {
      expect(ROOMS[item.room]).toBeDefined();
    }
    for (const prop of PROPS) {
      expect(ROOMS[prop.room]).toBeDefined();
    }
  });

  it("NPC, 엘리베이터 목적지, 추격 이벤트 데이터가 유효하게 연결되어 있어야 한다", () => {
    for (const npc of NPCS) {
      expect(ROOMS[npc.room]).toBeDefined();
      expect(NPC_DIALOGUES[npc.id]).toBeDefined();
    }

    for (const dest of ELEVATOR_DESTINATIONS) {
      expect(ROOMS[dest.toRoom]).toBeDefined();
    }

    for (const ev of GHOST_EVENTS) {
      expect(ROOMS[ev.room]).toBeDefined();
    }
  });
});
