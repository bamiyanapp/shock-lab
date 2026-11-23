import { describe, expect, it } from "vitest";
import { shouldApplyDrivingForce, OVERTURN_ANGLE_THRESHOLD_RAD } from "./driveControl";

describe("shouldApplyDrivingForce", () => {
  it("drives when at least one wheel is grounded and the chassis is upright", () => {
    expect(
      shouldApplyDrivingForce({ isFrontWheelGrounded: true, isRearWheelGrounded: false, chassisAngle: 0 })
    ).toBe(true);
    expect(
      shouldApplyDrivingForce({ isFrontWheelGrounded: false, isRearWheelGrounded: true, chassisAngle: 0 })
    ).toBe(true);
  });

  it("does not drive when both wheels are airborne", () => {
    expect(
      shouldApplyDrivingForce({ isFrontWheelGrounded: false, isRearWheelGrounded: false, chassisAngle: 0 })
    ).toBe(false);
  });

  it("does not drive once the chassis has overturned, even if a wheel is grounded", () => {
    expect(
      shouldApplyDrivingForce({
        isFrontWheelGrounded: true,
        isRearWheelGrounded: true,
        chassisAngle: OVERTURN_ANGLE_THRESHOLD_RAD + 0.1,
      })
    ).toBe(false);
    expect(
      shouldApplyDrivingForce({
        isFrontWheelGrounded: true,
        isRearWheelGrounded: true,
        chassisAngle: -(OVERTURN_ANGLE_THRESHOLD_RAD + 0.1),
      })
    ).toBe(false);
  });

  it("still drives for ordinary tilt while riding a bump (below the overturn threshold)", () => {
    expect(
      shouldApplyDrivingForce({
        isFrontWheelGrounded: true,
        isRearWheelGrounded: true,
        chassisAngle: OVERTURN_ANGLE_THRESHOLD_RAD - 0.1,
      })
    ).toBe(true);
  });

  it("四駆は、前後どちらかが接地していれば駆動する（既定。driveType省略も同じ）", () => {
    for (const driveType of ["awd", undefined] as const) {
      expect(shouldApplyDrivingForce({ isFrontWheelGrounded: true, isRearWheelGrounded: false, chassisAngle: 0, driveType })).toBe(true);
      expect(shouldApplyDrivingForce({ isFrontWheelGrounded: false, isRearWheelGrounded: true, chassisAngle: 0, driveType })).toBe(true);
    }
  });

  it("FFは前輪、FRは後輪が接地しているときだけ駆動する（issue #535）", () => {
    const frontOnly = { isFrontWheelGrounded: true, isRearWheelGrounded: false, chassisAngle: 0 };
    const rearOnly = { isFrontWheelGrounded: false, isRearWheelGrounded: true, chassisAngle: 0 };
    expect(shouldApplyDrivingForce({ ...frontOnly, driveType: "ff" })).toBe(true);
    expect(shouldApplyDrivingForce({ ...rearOnly, driveType: "ff" })).toBe(false);
    expect(shouldApplyDrivingForce({ ...rearOnly, driveType: "fr" })).toBe(true);
    expect(shouldApplyDrivingForce({ ...frontOnly, driveType: "fr" })).toBe(false);
  });

  it("どの駆動方式でも、両輪が浮いていれば駆動しない", () => {
    for (const driveType of ["awd", "ff", "fr"] as const) {
      expect(shouldApplyDrivingForce({ isFrontWheelGrounded: false, isRearWheelGrounded: false, chassisAngle: 0, driveType })).toBe(false);
    }
  });

  it("空中で1回転（2π・4π）して正しい向きの車体は、駆動が止まらない（issue #519）", () => {
    for (const chassisAngle of [Math.PI * 2, Math.PI * 4, -Math.PI * 2]) {
      expect(shouldApplyDrivingForce({ isFrontWheelGrounded: true, isRearWheelGrounded: true, chassisAngle })).toBe(true);
    }
  });

  it("1回転半（3π）の逆さまは、駆動しない", () => {
    expect(shouldApplyDrivingForce({ isFrontWheelGrounded: true, isRearWheelGrounded: true, chassisAngle: Math.PI * 3 })).toBe(false);
  });
});
