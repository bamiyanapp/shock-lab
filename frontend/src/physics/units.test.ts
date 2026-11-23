import { describe, expect, it } from "vitest";
import { normalizeAngleRad } from "./units";

describe("normalizeAngleRad", () => {
  it("範囲内の角度はそのまま返す", () => {
    expect(normalizeAngleRad(0)).toBe(0);
    expect(normalizeAngleRad(1)).toBeCloseTo(1, 10);
    expect(normalizeAngleRad(-1)).toBeCloseTo(-1, 10);
  });

  it("何回転していても、向きが同じなら同じ値になる", () => {
    expect(normalizeAngleRad(Math.PI * 2)).toBeCloseTo(0, 10);
    expect(normalizeAngleRad(Math.PI * 4 + 0.5)).toBeCloseTo(0.5, 10);
    expect(normalizeAngleRad(-Math.PI * 6 - 0.5)).toBeCloseTo(-0.5, 10);
  });

  it("逆さま（π・3π・-π）は絶対値πになる", () => {
    expect(Math.abs(normalizeAngleRad(Math.PI))).toBeCloseTo(Math.PI, 10);
    expect(Math.abs(normalizeAngleRad(Math.PI * 3))).toBeCloseTo(Math.PI, 10);
    expect(Math.abs(normalizeAngleRad(-Math.PI))).toBeCloseTo(Math.PI, 10);
  });
});
