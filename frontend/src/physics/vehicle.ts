import Matter from "matter-js";
import type { VehicleBodyParams, TireParams } from "../types/vehicle";

export interface VehicleBodies {
  chassis: Matter.Body;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
}

const PIXELS_PER_METER = 60;
// weightKgをそのままdensity（質量/面積）に使うと、タイヤ（Matter.jsの既定density 0.001）に対し
// chassisの質量が桁違いに重くなり、タイヤの駆動力ではほぼ前進できなくなる。基準車重における
// chassis densityをタイヤの数倍程度に正規化し、車重の変化に応じて比例スケールさせる。
const REFERENCE_WEIGHT_KG = 1200;
const REFERENCE_CHASSIS_DENSITY = 0.003;
// frontWeightRatio/centerOfGravityHeightの基準値（simulationStoreの既定車両パラメータと一致）。
const REFERENCE_COG_HEIGHT_M = 0.5;
// タイヤ剛性の基準値（simulationStoreの既定タイヤパラメータと一致）。
const REFERENCE_TIRE_STIFFNESS = 200000;

/**
 * 車体・前輪・後輪の剛体を生成する（サスペンションでの接続は行わない）。
 */
export function createVehicleBodies(
  body: VehicleBodyParams,
  tire: TireParams,
  originX: number,
  originY: number
): VehicleBodies {
  const wheelbasePx = body.wheelbase * PIXELS_PER_METER;
  const wheelRadiusPx = (tire.diameter / 2) * PIXELS_PER_METER;
  const chassisHeightPx = 40;
  const chassisWidthPx = wheelbasePx + 60;

  const chassis = Matter.Bodies.rectangle(
    originX,
    originY - wheelRadiusPx - chassisHeightPx / 2,
    chassisWidthPx,
    chassisHeightPx,
    { density: REFERENCE_CHASSIS_DENSITY * (body.weightKg / REFERENCE_WEIGHT_KG), friction: 0.5 }
  );

  // Matter.jsは非一様密度の剛体を直接表現できないため、前後重量配分・重心高さの違いを
  // chassisの質量中心（回転軸）のオフセットとして近似する（Body.setCentreは重心=回転軸のみを
  // 動かし、chassisの見た目上の矩形位置・サイズは変えない）。前重心の車ほど前方が沈みやすく、
  // 重心が高い車ほど（回転しやすくなり）転倒しやすくなる。
  const weightBiasRatio = Math.max(-0.5, Math.min(0.5, body.frontWeightRatio - 0.5));
  const centerOfMassOffsetXPx = weightBiasRatio * chassisWidthPx * 0.6;
  const cogHeightBiasRatio = Math.max(
    -1,
    Math.min(1, (body.centerOfGravityHeight - REFERENCE_COG_HEIGHT_M) / REFERENCE_COG_HEIGHT_M)
  );
  const centerOfMassOffsetYPx = -cogHeightBiasRatio * chassisHeightPx * 0.3;
  Matter.Body.setCentre(chassis, { x: centerOfMassOffsetXPx, y: centerOfMassOffsetYPx }, true);

  // タイヤ剛性が高いほど衝撃を跳ね返しやすく（反発係数が高く）、低いほど衝撃を吸収して
  // 潰れるように跳ねにくくなることを反発係数の違いとして近似する。
  const tireRestitution = Math.max(
    0.05,
    Math.min(0.3, 0.05 + (tire.stiffness / REFERENCE_TIRE_STIFFNESS) * 0.1)
  );

  const frontWheel = Matter.Bodies.circle(originX + wheelbasePx / 2, originY, wheelRadiusPx, {
    friction: 0.9,
    restitution: tireRestitution,
  });

  const rearWheel = Matter.Bodies.circle(originX - wheelbasePx / 2, originY, wheelRadiusPx, {
    friction: 0.9,
    restitution: tireRestitution,
  });

  return { chassis, frontWheel, rearWheel };
}
