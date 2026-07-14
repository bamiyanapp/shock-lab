const AIR_DRAG_COEFFICIENT = 0.0006;

/**
 * 速度の2乗に比例する空気抵抗による、1tickあたりの速度減衰量(px/step)を計算する。
 * 駆動力を適用しない（タイヤが非接地・車体転倒時の）状況でのみ意味を持つ
 * （駆動中は速度を毎tick強制するため、この抵抗を適用しても直後に上書きされる）。
 */
export function computeAirDragDeceleration(velocityXPerStep: number): number {
  return Math.sign(velocityXPerStep) * AIR_DRAG_COEFFICIENT * velocityXPerStep * velocityXPerStep;
}
