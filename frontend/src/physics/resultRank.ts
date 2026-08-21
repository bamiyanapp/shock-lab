export type ResultRank = "S" | "A" | "B" | "C";

export interface ResultStats {
  /** 走行中の最大衝撃（|verticalG|の最大値） */
  maxImpact: number;
  /** 底付きが発生した回数 */
  bottomOutCount: number;
  /** 走行中の平均|verticalG|（値が小さいほど乗り心地が良い） */
  averageAbsVerticalG: number;
}

/**
 * 乗り心地スコアからS/A/B/Cランクを判定する。走破タイムは試験速度（ユーザー設定値）に
 * ほぼ比例するだけでセッティングの巧拙を反映しないため、ランク判定には含めない
 * （リザルト画面には参考値として別途表示する）。
 * 上位ランクほど基準が厳しく、底付き・最大衝撃・平均Gのいずれかが基準を超えると
 * 1段階下のランクに落ちる。
 */
export function computeResultRank(stats: ResultStats): ResultRank {
  const { maxImpact, bottomOutCount, averageAbsVerticalG } = stats;

  if (bottomOutCount === 0 && maxImpact < 2.0 && averageAbsVerticalG < 0.3) return "S";
  if (bottomOutCount === 0 && maxImpact < 3.5 && averageAbsVerticalG < 0.5) return "A";
  if (bottomOutCount <= 2 && maxImpact < 5.0) return "B";
  return "C";
}
