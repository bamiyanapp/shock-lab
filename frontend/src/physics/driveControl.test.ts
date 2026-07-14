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
});
