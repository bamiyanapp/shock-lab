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
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
    });

    expect(metrics.speed).toBe(0);
    expect(metrics.suspensionStroke).toBe(0);
    expect(metrics.verticalG).toBe(0);
    expect(metrics.maxImpact).toBe(0);
    expect(metrics.isBottomedOut).toBe(false);
    expect(metrics.bottomOutCount).toBe(0);
  });

  it("reports a positive suspensionStroke when the suspension is compressed below its rest length", () => {
    const { metrics } = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 18,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
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
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
    });
    expect(first.metrics.maxImpact).toBeCloseTo(Math.abs(first.metrics.verticalG), 10);

    const second = computeMetrics({
      chassisVelocity: { x: 0, y: 9 },
      previousVerticalVelocityPxPerStep: first.verticalVelocityPxPerStep,
      frontSuspensionLengthPx: 24,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: first.metrics.maxImpact,
      strokeLength: 0.15,
      previousIsBottomedOut: first.metrics.isBottomedOut,
      previousBottomOutCount: first.metrics.bottomOutCount,
    });
    // 減速局面ではverticalGの絶対値が小さくなるため、maxImpactは前ステップの値を維持する
    expect(second.metrics.maxImpact).toBe(first.metrics.maxImpact);
  });

  it("reports isBottomedOut once suspensionStroke reaches strokeLength", () => {
    const { metrics } = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      // (24 - 15) / 60 = 0.15m のストローク。strokeLength 0.15と同値のため底付き
      frontSuspensionLengthPx: 15,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
    });

    expect(metrics.isBottomedOut).toBe(true);
    expect(metrics.bottomOutCount).toBe(1);
  });

  it("does not increment bottomOutCount while isBottomedOut stays true across ticks", () => {
    const first = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 15,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
    });
    expect(first.metrics.bottomOutCount).toBe(1);

    const second = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: first.verticalVelocityPxPerStep,
      frontSuspensionLengthPx: 15,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: first.metrics.maxImpact,
      strokeLength: 0.15,
      previousIsBottomedOut: first.metrics.isBottomedOut,
      previousBottomOutCount: first.metrics.bottomOutCount,
    });

    expect(second.metrics.isBottomedOut).toBe(true);
    expect(second.metrics.bottomOutCount).toBe(1);
  });

  it("increments bottomOutCount again after recovering from a bottom-out and hitting a new one", () => {
    const bottomedOut = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: 0,
      frontSuspensionLengthPx: 15,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: 0,
      strokeLength: 0.15,
      previousIsBottomedOut: false,
      previousBottomOutCount: 0,
    });
    expect(bottomedOut.metrics.bottomOutCount).toBe(1);

    const recovered = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: bottomedOut.verticalVelocityPxPerStep,
      frontSuspensionLengthPx: 20,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: bottomedOut.metrics.maxImpact,
      strokeLength: 0.15,
      previousIsBottomedOut: bottomedOut.metrics.isBottomedOut,
      previousBottomOutCount: bottomedOut.metrics.bottomOutCount,
    });
    expect(recovered.metrics.isBottomedOut).toBe(false);
    expect(recovered.metrics.bottomOutCount).toBe(1);

    const bottomedOutAgain = computeMetrics({
      chassisVelocity: { x: 0, y: 0 },
      previousVerticalVelocityPxPerStep: recovered.verticalVelocityPxPerStep,
      frontSuspensionLengthPx: 15,
      frontSuspensionRestLengthPx: 24,
      previousMaxImpact: recovered.metrics.maxImpact,
      strokeLength: 0.15,
      previousIsBottomedOut: recovered.metrics.isBottomedOut,
      previousBottomOutCount: recovered.metrics.bottomOutCount,
    });
    expect(bottomedOutAgain.metrics.isBottomedOut).toBe(true);
    expect(bottomedOutAgain.metrics.bottomOutCount).toBe(2);
  });
});
