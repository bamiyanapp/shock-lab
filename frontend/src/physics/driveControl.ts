import { normalizeAngleRad } from "./units";
import type { DriveType } from "../types/vehicle";

/** 車体がこの角度（ラジアン）を超えて傾いたら「転倒」とみなす。 */
export const OVERTURN_ANGLE_THRESHOLD_RAD = Math.PI / 2;

export interface DriveConditions {
  isFrontWheelGrounded: boolean;
  isRearWheelGrounded: boolean;
  chassisAngle: number;
  /** 省略時は四駆（前後どちらかが接地していれば駆動する） */
  driveType?: DriveType;
}

/** 駆動輪のいずれかが接地しているか。四駆は前後どちらか、FFは前輪、FRは後輪が駆動輪 */
export function isDrivenWheelGrounded(conditions: DriveConditions): boolean {
  switch (conditions.driveType ?? "awd") {
    case "ff":
      return conditions.isFrontWheelGrounded;
    case "fr":
      return conditions.isRearWheelGrounded;
    case "awd":
      return conditions.isFrontWheelGrounded || conditions.isRearWheelGrounded;
  }
}

/**
 * 駆動力（試験速度に応じた強制速度）を適用してよいかどうかを判定する純粋関数。
 * - 駆動輪が地面に接地していない（ジャンプ中・落下中・駆動輪だけ浮いた）場合は駆動しない
 * - 車体が転倒している場合は駆動しない（ブレーキがかかった状態を表す）
 * 角度は回転数ぶん増え続けるため、正規化した向きで判定する。空中で1回転して正しい向きで
 * 着地した車体の駆動を止めないため（issue #519・#535）。
 */
export function shouldApplyDrivingForce(conditions: DriveConditions): boolean {
  const isOverturned = Math.abs(normalizeAngleRad(conditions.chassisAngle)) > OVERTURN_ANGLE_THRESHOLD_RAD;
  return isDrivenWheelGrounded(conditions) && !isOverturned;
}

/**
 * 駆動による加速度(m/s²)。停止状態から目標速度（試験速度）まで、この加速度で加速する（issue #516）。
 * 5m/s なら約1.3秒、30m/s なら約7.5秒で目標速度に達する。
 */
export const DRIVE_ACCELERATION_MS2 = 4;

/**
 * 駆動を適用する1tickぶんの、水平速度(px/step)を計算する純粋関数。
 * - 目標速度に達するまで、一定の加速度で加速する。目標速度を超えて加速しない
 * - すでに目標速度以上（下り坂・段差の勢いなど）なら、駆動力は足さない（ブレーキもかけない）
 * 速度を直接目標へ置き換えず加算にしているため、段差・斜面で落ちた速度は、駆動で回復するまで
 * 落ちたままになる（段差・斜面で減速する）。
 */
export function computeDrivenVelocityX(
  currentVelocityXPerStep: number,
  targetVelocityXPerStep: number,
  accelerationPerStep2: number
): number {
  if (currentVelocityXPerStep >= targetVelocityXPerStep) return currentVelocityXPerStep;
  return Math.min(targetVelocityXPerStep, currentVelocityXPerStep + accelerationPerStep2);
}
