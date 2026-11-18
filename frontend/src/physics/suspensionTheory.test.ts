import { describe, expect, it } from "vitest";
import { computeSuspensionTheory } from "./suspensionTheory";

// ばね上質量 = 車重 - 160kg（前後2軸のばね下質量）、4輪ぶんのバネ・ダンパーで支える。
describe("computeSuspensionTheory", () => {
  it("computes the natural frequency as (1/2π)√(4k/m)", () => {
    const { naturalFrequencyHz } = computeSuspensionTheory(30000, 3000, 1200);
    expect(naturalFrequencyHz).toBeCloseTo((1 / (2 * Math.PI)) * Math.sqrt((4 * 30000) / 1040), 10);
  });

  it("computes the damping ratio as 4c/(2√(4km))", () => {
    const { dampingRatio } = computeSuspensionTheory(30000, 3000, 1200);
    expect(dampingRatio).toBeCloseTo((4 * 3000) / (2 * Math.sqrt(4 * 30000 * 1040)), 10);
  });

  it("gives about 1.7Hz and ζ≈0.54 for the default sedan (close to real cars)", () => {
    const { naturalFrequencyHz, dampingRatio } = computeSuspensionTheory(30000, 3000, 1200);
    expect(naturalFrequencyHz).toBeGreaterThan(1.6);
    expect(naturalFrequencyHz).toBeLessThan(1.8);
    expect(dampingRatio).toBeGreaterThan(0.5);
    expect(dampingRatio).toBeLessThan(0.6);
  });

  it("reports an underdamped ratio (< 1) for a soft damper relative to the spring", () => {
    const { dampingRatio } = computeSuspensionTheory(30000, 100, 1200);
    expect(dampingRatio).toBeLessThan(1);
  });

  it("reports an overdamped ratio (> 1) for a stiff damper relative to the spring", () => {
    const { dampingRatio } = computeSuspensionTheory(30000, 50000, 1200);
    expect(dampingRatio).toBeGreaterThan(1);
  });
});
