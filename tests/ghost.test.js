import { describe, it, expect, beforeEach } from "vitest";
import { state } from "../js/state.js";
import { BREATH_CONFIG } from "../js/config.js";
import {
  isBlocked,
  findNearestWalkable,
  getNextBfsStep,
  beginBreathHoldMinigame,
  holdBreathAction
} from "../js/ghost.js";

describe("추격자 BFS 경로 탐색 및 은신 숨 참기 검증", () => {
  beforeEach(() => {
    state.isHiding = false;
    state.hidingUseCount = {};
    state.breathHold = {
      active: false,
      gauge: BREATH_CONFIG.BASE_GAUGE,
      timer: 0,
      duration: BREATH_CONFIG.BASE_DURATION
    };
  });

  it("외벽 및 가구 좌표는 통행 불가(isBlocked === true)로 판정되어야 한다", () => {
    expect(isBlocked("1층 복도", 0, 0)).toBe(true);
    // 1층 복도 우편함 가구 영역 내부
    expect(isBlocked("1층 복도", 3, 2)).toBe(true);
    // 통로 바닥
    expect(isBlocked("1층 복도", 4, 5)).toBe(false);
  });

  it("막힌 좌표 입력 시 findNearestWalkable이 가장 가까운 이동 가능 타일을 반환해야 한다", () => {
    const pos = findNearestWalkable("1층 복도", 0, 0);
    expect(isBlocked("1층 복도", pos.x, pos.y)).toBe(false);
  });

  it("getNextBfsStep이 장애물을 피해 목표 타일까지 연결되는 유효한 첫 걸음을 계산해야 한다", () => {
    let cx = 2;
    let cy = 5;
    const gx = 12;
    const gy = 5;

    for (let steps = 0; steps < 30; steps++) {
      if (cx === gx && cy === gy) break;
      const next = getNextBfsStep("1층 복도", cx, cy, gx, gy);
      expect(isBlocked("1층 복도", next.x, next.y)).toBe(false);
      expect(Math.abs(next.x - cx) + Math.abs(next.y - cy)).toBe(1);
      cx = next.x;
      cy = next.y;
    }

    expect({ x: cx, y: cy }).toEqual({ x: gx, y: gy });
  });

  it("은신처 반복 사용 시 숨 참기 초기 게이지가 감소하고 필요 지속 시간이 증가해야 한다", () => {
    state.hidingUseCount["hide_1"] = 1;
    beginBreathHoldMinigame("hide_1");
    const firstGauge = state.breathHold.gauge;
    const firstDuration = state.breathHold.duration;

    state.hidingUseCount["hide_1"] = 3;
    beginBreathHoldMinigame("hide_1");
    expect(state.breathHold.gauge).toBeLessThan(firstGauge);
    expect(state.breathHold.duration).toBeGreaterThan(firstDuration);

    state.isHiding = true;
    state.breathHold.gauge = 90;
    expect(holdBreathAction()).toBe(true);
    expect(state.breathHold.gauge).toBe(100);
  });
});
