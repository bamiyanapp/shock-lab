import type { RunPhase } from "../store/simulationStore";

/**
 * メトリクスを表示してよい走行状態かを判定する純粋関数（issue #553）。走行前（idle）は、
 * 表示する走行データが無いため隠す。走行中は、フルスクリーンでグラフが見えないため描かない。
 * 一時停止中と、ゴール・リタイアによる終了後に表示する。
 */
export function shouldShowMetrics(phase: RunPhase): boolean {
  return phase === "paused" || phase === "finished";
}
