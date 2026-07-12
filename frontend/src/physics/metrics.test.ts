import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";

describe("computeMetrics", () => {
  it("returns zero metrics when the chassis is at rest and the suspension is at its rest length", () => {
    const { metrics } = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 24,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
    });

    expect(metrics.speed).toBe(0);
    expect(metrics.suspensionStroke).toBe(0);
    expect(metrics.verticalG).toBe(0);
    expect(metrics.maxImpact).toBe(0);
  });

  it("reports a positive suspensionStroke when the suspension is compressed below its rest length", () => {
    const { metrics } = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 18,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
    });

    expect(metrics.suspensionStroke).toBeCloseTo(0.1, 5);
  });

  it("tracks maxImpact as the running maximum of |verticalG| across ticks", () => {
    const first = computeMetrics({
      chassisVelocity: { x: 0, y: 10 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 24,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
    });
    expect(first.metrics.maxImpact).toBeCloseTo(Math.abs(first.metrics.verticalG), 10);

    const second = computeMetrics({
      chassisVelocity: { x: 0, y: 9 },
      previousVerticalVelocityPxPerStep: first.verticalVelocityPxPerStep,
      frontSuspensionLengthPx: 24,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: first.metrics.maxImpact,
    });
    // 減速局面ではverticalGの絶対値が小さくなるため、maxImpactは前ステップの値を維持する
    expect(second.metrics.maxImpact).toBe(first.metrics.maxImpact);
  });
});
