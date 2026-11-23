import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DriveTypeIcon } from "./DriveTypeIcon";
import { DRIVEN_WHEELS } from "./driveTypeIcons";
import { isDrivenWheelGrounded } from "../physics/driveControl";
import { DRIVE_TYPES } from "../store/parameterRanges";

describe("DriveTypeIcon（issue #552）", () => {
  it("駆動輪だけが色付けされる（四駆=前後、FF=前輪のみ、FR=後輪のみ）", () => {
    const drivenOf = (driveType: (typeof DRIVE_TYPES)[number]) => {
      const { container } = render(<DriveTypeIcon driveType={driveType} />);
      const read = (wheel: "front" | "rear") =>
        container.querySelector(`[data-wheel="${wheel}"]`)?.getAttribute("data-driven") === "true";
      return { front: read("front"), rear: read("rear") };
    };
    expect(drivenOf("awd")).toEqual({ front: true, rear: true });
    expect(drivenOf("ff")).toEqual({ front: true, rear: false });
    expect(drivenOf("fr")).toEqual({ front: false, rear: true });
  });

  it("駆動輪は、色に加えて、斜線の模様でも区別される（色だけに頼らない）", () => {
    const { container } = render(<DriveTypeIcon driveType="ff" />);
    const front = container.querySelector('[data-wheel="front"]');
    const rear = container.querySelector('[data-wheel="rear"]');
    expect(front?.querySelectorAll("circle")).toHaveLength(2);
    expect(rear?.querySelectorAll("circle")).toHaveLength(1);
  });

  it("イラストは装飾で、読み上げの対象にしない", () => {
    const { container } = render(<DriveTypeIcon driveType="awd" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("イラストの駆動輪は、物理の駆動判定（isDrivenWheelGrounded）と一致する", () => {
    for (const driveType of DRIVE_TYPES) {
      const base = { chassisAngle: 0, driveType };
      expect(isDrivenWheelGrounded({ ...base, isFrontWheelGrounded: true, isRearWheelGrounded: false })).toBe(
        DRIVEN_WHEELS[driveType].front
      );
      expect(isDrivenWheelGrounded({ ...base, isFrontWheelGrounded: false, isRearWheelGrounded: true })).toBe(
        DRIVEN_WHEELS[driveType].rear
      );
    }
  });
});
