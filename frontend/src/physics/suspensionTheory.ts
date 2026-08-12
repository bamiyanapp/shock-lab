/**
 * バネ定数k・車重m・ダンパー減衰係数cから、サスペンションの理論値を算出する。
 * Matter.js側の近似スケーリング（suspension.ts）とは独立した、教育目的の理論値表示用。
 */
export interface SuspensionTheory {
  /** 固有振動数(Hz) */
  naturalFrequencyHz: number;
  /** 減衰比（無次元）。1未満はアンダーダンピング、1超はオーバーダンピング */
  dampingRatio: number;
}

export function computeSuspensionTheory(
  springConstant: number,
  damperCoefficient: number,
  weightKg: number
): SuspensionTheory {
  const naturalFrequencyHz = (1 / (2 * Math.PI)) * Math.sqrt(springConstant / weightKg);
  const dampingRatio = damperCoefficient / (2 * Math.sqrt(springConstant * weightKg));

  return { naturalFrequencyHz, dampingRatio };
}
