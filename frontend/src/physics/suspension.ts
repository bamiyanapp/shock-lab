import Matter from "matter-js";
import type { SuspensionParams } from "../types/vehicle";

/**
 * 車体とタイヤをバネ・ダンパー特性を持つconstraintで接続する。
 * Matter.jsのconstraintはダンパー項を直接持たないため、stiffnessをバネ定数の近似、
 * dampingをダンパー減衰係数の近似として利用する。
 */
export function createSuspensionConstraint(
  chassis: Matter.Body,
  wheel: Matter.Body,
  params: SuspensionParams
): Matter.Constraint {
  return Matter.Constraint.create({
    bodyA: chassis,
    bodyB: wheel,
    pointA: { x: wheel.position.x - chassis.position.x, y: 0 },
    length: params.rideHeight * 60,
    stiffness: Math.min(params.springConstant / 100000, 1),
    damping: Math.min(params.damperCoefficient / 10000, 1),
  });
}
