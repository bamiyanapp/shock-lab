/**
 * 車体の絵の寸法を、車体座標（原点=車体の重心、x=進行方向、y=下向き）で決める純粋関数。
 * 物理と同じ値（前後の取り付け位置・タイヤ半径）から導き、絵と物理がずれないようにする。
 *
 * 寸法の定義（issue #509・#513）:
 * - バネの取り付け位置は、物理の取り付け点（車体の重心の高さ、y=0）。ホイールハウス（アーチ）の
 *   頂点をここに置く。バネの上端が、絵の上でもアーチの頂点から出ているように見える
 * - アーチは半径 ARCH_RADIUS_RATIO × タイヤ半径の円。中心はy=アーチ半径（頂点がy=0）
 * - 車体の底面は、アーチの中心の高さ。タイヤはバネの静止長（車高）だけ取り付け位置より下にあるため、
 *   車高を上げるほど車体とタイヤの間にすき間ができ、下げるほどタイヤがアーチへ入り込む
 * - 地上高（車体の底面から地面まで）= 車高 − (アーチ半径 − タイヤ半径)。車高0.4m・タイヤ径0.6mなら約0.34m
 */
export const ARCH_RADIUS_RATIO = 1.2;
const OVERHANG_RATIO = 0.9; // タイヤ半径に対する、前後のはみ出し
const HULL_TOP_RATIO = -0.8; // 車体上面の高さ（アーチ頂点より上）。タイヤ半径に対する比
const CABIN_HEIGHT_RATIO = 1.3;

export interface VehicleLayout {
  /** 車体の前後の端（x）。前が正 */
  bodyFrontX: number;
  bodyRearX: number;
  /** 車体の上面・底面（y。下向きが正） */
  hullTopY: number;
  floorY: number;
  cabinTopY: number;
  cabinFrontX: number;
  cabinRearX: number;
  archRadius: number;
  archCenterY: number;
  /** アーチの中心x（前軸・後軸の取り付け位置） */
  frontArchX: number;
  rearArchX: number;
}

/**
 * @param frontArmPx 車体の重心から前軸までの水平距離（正）
 * @param rearArmPx 車体の重心から後軸までの水平距離（負。SuspensionAxle.armPxと同じ符号）
 */
export function computeVehicleLayout(frontArmPx: number, rearArmPx: number, wheelRadiusPx: number): VehicleLayout {
  const overhang = wheelRadiusPx * OVERHANG_RATIO;
  const archRadius = wheelRadiusPx * ARCH_RADIUS_RATIO;
  const bodyFrontX = frontArmPx + overhang;
  const bodyRearX = rearArmPx - overhang;
  const length = bodyFrontX - bodyRearX;
  const hullTopY = wheelRadiusPx * HULL_TOP_RATIO;
  return {
    bodyFrontX,
    bodyRearX,
    hullTopY,
    floorY: archRadius,
    cabinTopY: hullTopY - wheelRadiusPx * CABIN_HEIGHT_RATIO,
    cabinFrontX: bodyFrontX - length * 0.26,
    cabinRearX: bodyRearX + length * 0.2,
    archRadius,
    archCenterY: archRadius,
    frontArchX: frontArmPx,
    rearArchX: rearArmPx,
  };
}

/** 車体の底面から地面までの地上高(px)。車高（バネの静止長）とタイヤ半径から決まる */
export function computeGroundClearancePx(restLengthPx: number, wheelRadiusPx: number): number {
  return restLengthPx - (wheelRadiusPx * ARCH_RADIUS_RATIO - wheelRadiusPx);
}
