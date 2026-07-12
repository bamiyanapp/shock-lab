import Matter from "matter-js";
import type { VehicleBodyParams, TireParams } from "../types/vehicle";

export interface VehicleBodies {
  chassis: Matter.Body;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
}

const PIXELS_PER_METER = 60;

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
    { density: body.weightKg / ((wheelbasePx + 60) * chassisHeightPx), friction: 0.5 }
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
