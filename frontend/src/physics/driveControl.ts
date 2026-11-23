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
