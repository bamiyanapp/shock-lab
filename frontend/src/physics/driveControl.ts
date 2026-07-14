/** 車体がこの角度（ラジアン）を超えて傾いたら「転倒」とみなす。 */
export const OVERTURN_ANGLE_THRESHOLD_RAD = Math.PI / 2;

export interface DriveConditions {
  isFrontWheelGrounded: boolean;
  isRearWheelGrounded: boolean;
  chassisAngle: number;
}

/**
 * 駆動力（試験速度に応じた強制速度）を適用してよいかどうかを判定する純粋関数。
 * - 前後輪のいずれも地面に接地していない（ジャンプ中・落下中）場合は駆動しない
 * - 車体が転倒している場合は駆動しない（ブレーキがかかった状態を表す）
 */
export function shouldApplyDrivingForce(conditions: DriveConditions): boolean {
  const isAnyWheelGrounded = conditions.isFrontWheelGrounded || conditions.isRearWheelGrounded;
  const isOverturned = Math.abs(conditions.chassisAngle) > OVERTURN_ANGLE_THRESHOLD_RAD;
  return isAnyWheelGrounded && !isOverturned;
}
