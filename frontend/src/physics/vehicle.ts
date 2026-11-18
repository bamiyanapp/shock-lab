import Matter from "matter-js";
import { MASS_SCALE, PIXELS_PER_METER, UNSPRUNG_MASS_KG } from "./units";
import type { VehicleBodyParams, TireParams, SuspensionParams } from "../types/vehicle";

export interface VehicleBodies {
  chassis: Matter.Body;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
}

// 車体の当たり判定矩形の高さ。サスペンションの静止長（車高スライダー下限0.1m=6px）でも
// 車体とタイヤが重ならないよう薄くしている（見た目はスプライト描画のため影響しない）。
const CHASSIS_HEIGHT_PX = 20;
// 自車の車体・タイヤは互いに衝突させない（同じ負のgroupを持つ剛体同士は衝突しない）。
const OWN_BODIES_COLLISION_GROUP = -1;
// centerOfGravityHeightの基準値（simulationStoreの既定車両パラメータと一致）。
const REFERENCE_COG_HEIGHT_M = 0.5;
// タイヤ剛性の基準値（simulationStoreの既定タイヤパラメータと一致）。
const REFERENCE_TIRE_STIFFNESS = 200000;

// Matter.jsの円（Bodies.circle）は辺数が半径に応じて高々数十の多角形になる。高速で転がすと
// 辺の乗り越えが毎tick起こり、平坦路でも車体が振動する（辺数の少ない多角形の転がり）。
// 辺数を増やした多角形で近似し、circleRadiusも設定して円として扱えるようにする。
const WHEEL_POLYGON_SIDES = 180;

function createWheel(
  x: number,
  y: number,
  radiusPx: number,
  options: Matter.IChamferableBodyDefinition
): Matter.Body {
  const wheel = Matter.Bodies.polygon(x, y, WHEEL_POLYGON_SIDES, radiusPx, options);
  wheel.circleRadius = radiusPx;
  return wheel;
}

/** ばね上質量(kg)。車重から前後2軸ぶんのばね下質量を引いた値 */
export function getSprungMassKg(weightKg: number): number {
  return Math.max(1, weightKg - 2 * UNSPRUNG_MASS_KG);
}

/** 車体の重心から前軸・後軸までの水平距離(px)。前重心ほど前軸に近くなる */
export function getAxleArmsPx(body: VehicleBodyParams): { front: number; rear: number } {
  const wheelbasePx = body.wheelbase * PIXELS_PER_METER;
  return { front: wheelbasePx * (1 - body.frontWeightRatio), rear: wheelbasePx * body.frontWeightRatio };
}

/**
 * 車体・前輪・後輪の剛体を、静止状態（タイヤが地面に接し、サスペンションが静止長）で生成する。
 * サスペンションでの接続はSuspensionAxleが行う。
 */
export function createVehicleBodies(
  body: VehicleBodyParams,
  tire: TireParams,
  suspension: SuspensionParams,
  originX: number,
  groundY: number
): VehicleBodies {
  const wheelRadiusPx = (tire.diameter / 2) * PIXELS_PER_METER;
  const restLengthPx = suspension.rideHeight * PIXELS_PER_METER;
  const arms = getAxleArmsPx(body);
  const wheelCenterY = groundY - wheelRadiusPx;
  const collisionFilter = { group: OWN_BODIES_COLLISION_GROUP };

  const chassisWidthPx = body.wheelbase * PIXELS_PER_METER + 60;
  const chassis = Matter.Bodies.rectangle(originX, wheelCenterY - restLengthPx, chassisWidthPx, CHASSIS_HEIGHT_PX, {
    friction: 0.5,
    frictionAir: 0,
    collisionFilter,
  });
  // 重心が高い車ほど（回転しやすくなり）転倒しやすくなる近似として、質量中心（回転軸）を
  // 上下へずらす。矩形の位置・サイズは変えない。
  const cogHeightBiasRatio = Math.max(
    -1,
    Math.min(1, (body.centerOfGravityHeight - REFERENCE_COG_HEIGHT_M) / REFERENCE_COG_HEIGHT_M)
  );
  Matter.Body.setCentre(chassis, { x: 0, y: -cogHeightBiasRatio * CHASSIS_HEIGHT_PX * 0.3 }, true);
  Matter.Body.setPosition(chassis, { x: originX, y: wheelCenterY - restLengthPx });
  Matter.Body.setMass(chassis, getSprungMassKg(body.weightKg) * MASS_SCALE);

  // タイヤ剛性が高いほど衝撃を跳ね返しやすく、低いほど吸収して跳ねにくくなることを
  // 反発係数の違いとして近似する。
  const tireRestitution = Math.max(0.05, Math.min(0.3, 0.05 + (tire.stiffness / REFERENCE_TIRE_STIFFNESS) * 0.1));
  const wheelOptions = { friction: 0.9, frictionAir: 0, restitution: tireRestitution, collisionFilter };

  const frontWheel = createWheel(originX + arms.front, wheelCenterY, wheelRadiusPx, wheelOptions);
  const rearWheel = createWheel(originX - arms.rear, wheelCenterY, wheelRadiusPx, wheelOptions);
  Matter.Body.setMass(frontWheel, UNSPRUNG_MASS_KG * MASS_SCALE);
  Matter.Body.setMass(rearWheel, UNSPRUNG_MASS_KG * MASS_SCALE);

  return { chassis, frontWheel, rearWheel };
}
