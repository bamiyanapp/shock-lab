import { GRAVITY_MS2, PIXELS_PER_METER, STEPS_PER_SECOND } from "./units";
import type { SimulationMetrics } from "../types/vehicle";

/** 上下Gの移動平均に使うtick数（0.1秒ぶん）。1tickごとのノイズを最大衝撃として拾わないため */
export const VERTICAL_G_AVERAGE_TICKS = 6;

export interface MetricsSample {
  chassisVelocity: { x: number; y: number };
  /** 直近の車体の上下加速度(px/step²)。末尾が今回のtick。移動平均を取る対象 */
  recentVerticalAccelerationsPxPerStep2: number[];
  /** 前軸の圧縮量(m)。縮むと正 */
  frontStrokeM: number;
  /** 後軸の圧縮量(m)。縮むと正 */
  rearStrokeM: number;
  previousMaxImpact: number;
  /** サスペンションのストローク量(m)。圧縮量がこの値に達すると底付きとみなす */
  strokeLength: number;
  previousIsBottomedOut: boolean;
  previousBottomOutCount: number;
}

/**
 * Matter.jsのafterUpdateイベント1tickぶんの状態から、車速・サスペンションストローク・
 * 上下G・最大衝撃を計算する。Matter.js自体に依存しない純粋関数として、単体テスト可能にしている。
 */
export function computeMetrics(sample: MetricsSample): SimulationMetrics {
  const {
    chassisVelocity,
    recentVerticalAccelerationsPxPerStep2,
    frontStrokeM,
    rearStrokeM,
    previousMaxImpact,
    strokeLength,
    previousIsBottomedOut,
    previousBottomOutCount,
  } = sample;

  const speed = (Math.hypot(chassisVelocity.x, chassisVelocity.y) * STEPS_PER_SECOND) / PIXELS_PER_METER;

  const window = recentVerticalAccelerationsPxPerStep2.slice(-VERTICAL_G_AVERAGE_TICKS);
  const averageAccelerationPxPerStep2 = window.length > 0 ? window.reduce((sum, value) => sum + value, 0) / window.length : 0;
  const verticalAccelerationMs2 = (averageAccelerationPxPerStep2 * STEPS_PER_SECOND * STEPS_PER_SECOND) / PIXELS_PER_METER;
  const verticalG = verticalAccelerationMs2 / GRAVITY_MS2;
  const maxImpact = Math.max(previousMaxImpact, Math.abs(verticalG));

  // 前後いずれかの軸が底付き（ストロークを使い切った）状態なら底付きとみなす。
  const isBottomedOut = Math.max(frontStrokeM, rearStrokeM) >= strokeLength;
  // 底付きが続いている間は毎tick加算せず、非底付き→底付きに切り替わった瞬間のみを1回として数える
  const bottomOutCount = previousBottomOutCount + (isBottomedOut && !previousIsBottomedOut ? 1 : 0);

  return {
    speed,
    suspensionStroke: frontStrokeM,
    rearSuspensionStroke: rearStrokeM,
    verticalG,
    maxImpact,
    isBottomedOut,
    bottomOutCount,
  };
}
