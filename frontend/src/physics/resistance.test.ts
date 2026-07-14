import { describe, expect, it } from "vitest";
import { computeAirDragDeceleration } from "./resistance";

describe("computeAirDragDeceleration", () => {
  it("returns zero deceleration at zero velocity", () => {
    expect(computeAirDragDeceleration(0)).toBe(0);
  });

  it("opposes the direction of motion", () => {
    expect(computeAirDragDeceleration(10)).toBeGreaterThan(0);
    expect(computeAirDragDeceleration(-10)).toBeLessThan(0);
  });

  it("grows with the square of speed, so it is stronger at higher speed", () => {
    const slow = Math.abs(computeAirDragDeceleration(5));
    const fast = Math.abs(computeAirDragDeceleration(10));
    expect(fast).toBeGreaterThan(slow * 3);
  });

  it("never decelerates past a full stop for a single tick at driving speeds", () => {
    // 試験速度の代表的な範囲（10〜30 m/s、PIXELS_PER_METER=60, STEPS_PER_SECOND=60換算で
    // 10〜30 px/step）で、1tickの減速量が速度そのものを超えない（符号反転しない）ことを確認する。
    for (const velocity of [10, 20, 30]) {
      const deceleration = computeAirDragDeceleration(velocity);
      expect(Math.abs(deceleration)).toBeLessThan(velocity);
    }
  });
});
