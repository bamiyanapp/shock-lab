import type { SimulationMetrics } from "../types/vehicle";

const PIXELS_PER_METER = 60;
const STEPS_PER_SECOND = 60;
const GRAVITY_MS2 = 9.8;

export interface MetricsSample {
  chassisVelocity: { x: number; y: number };
  previousVerticalVelocityPxPerStep: number;
  frontSuspensionLengthPx: number;
  frontSuspensionRestLengthPx: number;
  rearSuspensionLengthPx: number;
  rearSuspensionRestLengthPx: number;
  previousMaxImpact: number;
  /** サスペンションのストローク量(m)。この値に達すると底付きとみなす */
  strokeLength: number;
  previousIsBottomedOut: boolean;
  previousBottomOutCount: number;
}

export interface MetricsResult {
  metrics: SimulationMetrics;
  verticalVelocityPxPerStep: number;
}

/**
 * Matter.jsのafterUpdateイベント1tickぶんの状態から、車速・サスペンションストローク・
 * 上下G・最大衝撃を計算する。Matter.js自体に依存しない純粋関数として、単体テスト可能にしている。
 */
export function computeMetrics(sample: MetricsSample): MetricsResult {
  const {
    chassisVelocity,
    previousVerticalVelocityPxPerStep,
    frontSuspensionLengthPx,
    frontSuspensionRestLengthPx,
    rearSuspensionLengthPx,
    rearSuspensionRestLengthPx,
    previousMaxImpact,
    strokeLength,
    previousIsBottomedOut,
    previousBottomOutCount,
  } = sample;

  const speed = (Math.hypot(chassisVelocity.x, chassisVelocity.y) * STEPS_PER_SECOND) / PIXELS_PER_METER;

  const verticalAccelerationPxPerStep2 = chassisVelocity.y - previousVerticalVelocityPxPerStep;
  const verticalAccelerationMs2 =
    (verticalAccelerationPxPerStep2 * STEPS_PER_SECOND * STEPS_PER_SECOND) / PIXELS_PER_METER;
  const verticalG = verticalAccelerationMs2 / GRAVITY_MS2;

  const suspensionStroke = (frontSuspensionRestLengthPx - frontSuspensionLengthPx) / PIXELS_PER_METER;
  const rearSuspensionStroke = (rearSuspensionRestLengthPx - rearSuspensionLengthPx) / PIXELS_PER_METER;
  const maxImpact = Math.max(previousMaxImpact, Math.abs(verticalG));

  // 底付き判定はフロントストロークのみを基準にする（既存のisBottomedOut/bottomOutCountの意味を変えない）
  const isBottomedOut = suspensionStroke >= strokeLength;
  // 底付きが続いている間は毎tick加算せず、非底付き→底付きに切り替わった瞬間のみを1回として数える
  const bottomOutCount = previousBottomOutCount + (isBottomedOut && !previousIsBottomedOut ? 1 : 0);

  return {
    metrics: {
      speed,
      suspensionStroke,
      rearSuspensionStroke,
      verticalG,
      maxImpact,
      isBottomedOut,
      bottomOutCount,
    },
    verticalVelocityPxPerStep: chassisVelocity.y,
  };
}
