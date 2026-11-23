import { describe, expect, it } from "vitest";
import { computeMetrics, VERTICAL_G_AVERAGE_TICKS, type MetricsSample } from "./metrics";

const restSample: MetricsSample = {
  chassisVelocity: { x: 0, y: 0 },
  recentVerticalAccelerationsPxPerStep2: [0],
  frontStrokeM: 0,
  rearStrokeM: 0,
  previousMaxImpact: 0,
  strokeLength: 0.15,
  previousIsBottomedOut: false,
  previousBottomOutCount: 0,
};

describe("computeMetrics", () => {
  it("returns zero metrics when the chassis is at rest and the suspension is at its static length", () => {
    const metrics = computeMetrics(restSample);
    expect(metrics).toEqual({
      speed: 0,
      suspensionStroke: 0,
      rearSuspensionStroke: 0,
      verticalG: 0,
      maxImpact: 0,
      isBottomedOut: false,
      bottomOutCount: 0,
    });
  });

  it("converts px/step velocity to m/s (1px/step = 1m/s)", () => {
    expect(computeMetrics({ ...restSample, chassisVelocity: { x: 3, y: 4 } }).speed).toBeCloseTo(5, 10);
  });

  it("passes the front and rear compression through as the stroke values", () => {
    const metrics = computeMetrics({ ...restSample, frontStrokeM: 0.05, rearStrokeM: -0.02 });
    expect(metrics.suspensionStroke).toBeCloseTo(0.05, 10);
    expect(metrics.rearSuspensionStroke).toBeCloseTo(-0.02, 10);
  });

  it("treats a free-fall acceleration (g in px/step²) as 1G", () => {
    const gPxPerStep2 = (9.8 * 60) / 3600;
    const metrics = computeMetrics({ ...restSample, recentVerticalAccelerationsPxPerStep2: [gPxPerStep2] });
    expect(metrics.verticalG).toBeCloseTo(1, 5);
  });

  it("averages the vertical acceleration over the last 6 ticks so single-tick spikes are damped", () => {
    const spike = [0, 0, 0, 0, 0, (9.8 * 60) / 3600];
    expect(VERTICAL_G_AVERAGE_TICKS).toBe(6);
    expect(computeMetrics({ ...restSample, recentVerticalAccelerationsPxPerStep2: spike }).verticalG).toBeCloseTo(1 / 6, 5);
    // 6tickより古い値は平均に含めない
    const old = [(9.8 * 60) / 3600, 0, 0, 0, 0, 0, 0];
    expect(computeMetrics({ ...restSample, recentVerticalAccelerationsPxPerStep2: old }).verticalG).toBeCloseTo(0, 10);
  });

  it("keeps the larger of the previous and current |verticalG| as maxImpact", () => {
    const metrics = computeMetrics({ ...restSample, previousMaxImpact: 2 });
    expect(metrics.maxImpact).toBe(2);
  });

  it("flags a bottom-out when either the front or the rear stroke reaches strokeLength", () => {
    expect(computeMetrics({ ...restSample, frontStrokeM: 0.15 }).isBottomedOut).toBe(true);
    expect(computeMetrics({ ...restSample, rearStrokeM: 0.15 }).isBottomedOut).toBe(true);
    expect(computeMetrics({ ...restSample, frontStrokeM: 0.14, rearStrokeM: 0.14 }).isBottomedOut).toBe(false);
    // 浮動小数点の誤差でわずかに手前になっても、限界到達として扱う。
    expect(computeMetrics({ ...restSample, frontStrokeM: 0.1499999 }).isBottomedOut).toBe(true);
  });

  it("counts a bottom-out only on the transition into bottoming out, not while it continues", () => {
    const first = computeMetrics({ ...restSample, frontStrokeM: 0.15 });
    expect(first.bottomOutCount).toBe(1);
    const continuing = computeMetrics({
      ...restSample,
      frontStrokeM: 0.15,
      previousIsBottomedOut: true,
      previousBottomOutCount: 1,
    });
    expect(continuing.bottomOutCount).toBe(1);
  });

  it("keeps bottomed-out until the stroke relaxes below the exit ratio, so rebound chatter is one bottom-out", () => {
    const base = { ...restSample, previousIsBottomedOut: true, previousBottomOutCount: 1 };
    // 限界から少し戻っただけ（0.9）なら、底付き中のまま。数え直さない。
    const slightlyRelaxed = computeMetrics({ ...base, frontStrokeM: 0.135 });
    expect(slightlyRelaxed.isBottomedOut).toBe(true);
    expect(slightlyRelaxed.bottomOutCount).toBe(1);
    // 十分に戻る（0.8）と底付きが終わる。
    const relaxed = computeMetrics({ ...base, frontStrokeM: 0.12 });
    expect(relaxed.isBottomedOut).toBe(false);
    // 戻った後に再び限界へ達すれば、新しい底付きとして数える。
    const again = computeMetrics({ ...restSample, frontStrokeM: 0.15, previousIsBottomedOut: false, previousBottomOutCount: 1 });
    expect(again.bottomOutCount).toBe(2);
  });
});
