import type { DriveType } from "../types/vehicle";

/**
 * 駆動方式ごとの、駆動輪（前輪・後輪のどちらが駆動するか）。イラストの色付けと、テストで使う。
 * 物理側の判定（physics/driveControl.tsのisDrivenWheelGrounded）と一致させる（issue #552）。
 */
export const DRIVEN_WHEELS: Record<DriveType, { front: boolean; rear: boolean }> = {
  awd: { front: true, rear: true },
  ff: { front: true, rear: false },
  fr: { front: false, rear: true },
};

export const DRIVE_TYPE_LABELS: Record<DriveType, string> = {
  awd: "四駆（4WD）",
  ff: "前輪駆動（FF）",
  fr: "後輪駆動（FR）",
};
