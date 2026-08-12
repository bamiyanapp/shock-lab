import { describe, expect, it } from "vitest";
import { computeSuspensionTheory } from "./suspensionTheory";

describe("computeSuspensionTheory", () => {
  it("computes the natural frequency as (1/2π)√(k/m)", () => {
    const { naturalFrequencyHz } = computeSuspensionTheory(30000, 3000, 1200);
    expect(naturalFrequencyHz).toBeCloseTo((1 / (2 * Math.PI)) * Math.sqrt(30000 / 1200), 10);
  });

  it("computes the damping ratio as c/(2√(km))", () => {
    const { dampingRatio } = computeSuspensionTheory(30000, 3000, 1200);
    expect(dampingRatio).toBeCloseTo(3000 / (2 * Math.sqrt(30000 * 1200)), 10);
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
