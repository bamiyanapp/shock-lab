import { UNSPRUNG_MASS_KG } from "./units";

/**
 * バネ定数k・ダンパー減衰係数c・車重から、サスペンションの理論値を算出する。
 * スライダー値は1輪あたりで、車体の上下動（ヒーブ）は前後2軸×左右2輪＝4輪ぶんのバネ・ダンパーが
 * ばね上質量m（車重から前後2軸のばね下質量を引いた値）を支える1自由度系になる。
 * 実際のシミュレーション（suspension.ts）と同じ定義の、教育目的の理論値表示用。
 */
export interface SuspensionTheory {
  /** 固有振動数(Hz) */
  naturalFrequencyHz: number;
  /** 減衰比（無次元）。1未満はアンダーダンピング、1超はオーバーダンピング */
  dampingRatio: number;
}

const WHEELS = 4;

export function computeSuspensionTheory(
  springConstant: number,
  damperCoefficient: number,
  weightKg: number
): SuspensionTheory {
  const sprungMassKg = Math.max(1, weightKg - 2 * UNSPRUNG_MASS_KG);
  const totalSpring = WHEELS * springConstant;
  const totalDamper = WHEELS * damperCoefficient;
  const naturalFrequencyHz = (1 / (2 * Math.PI)) * Math.sqrt(totalSpring / sprungMassKg);
  const dampingRatio = totalDamper / (2 * Math.sqrt(totalSpring * sprungMassKg));

  return { naturalFrequencyHz, dampingRatio };
}
