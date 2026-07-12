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

  const chassis = Matter.Bodies.rectangle(
    originX,
    originY - wheelRadiusPx - chassisHeightPx / 2,
    wheelbasePx + 60,
    chassisHeightPx,
    { density: REFERENCE_CHASSIS_DENSITY * (body.weightKg / REFERENCE_WEIGHT_KG), friction: 0.5 }
  );

  const frontWheel = Matter.Bodies.circle(originX + wheelbasePx / 2, originY, wheelRadiusPx, {
    friction: 0.9,
    restitution: 0.1,
  });

  const rearWheel = Matter.Bodies.circle(originX - wheelbasePx / 2, originY, wheelRadiusPx, {
    friction: 0.9,
    restitution: 0.1,
  });

  return { chassis, frontWheel, rearWheel };
}
