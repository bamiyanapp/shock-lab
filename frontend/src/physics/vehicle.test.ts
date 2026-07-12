import { describe, expect, it } from "vitest";
import { createVehicleBodies } from "./vehicle";

describe("createVehicleBodies", () => {
  it("places the front wheel ahead of the rear wheel along the x axis", () => {
    const { chassis, frontWheel, rearWheel } = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    expect(frontWheel.position.x).toBeGreaterThan(rearWheel.position.x);
    expect(chassis.position.x).toBeCloseTo((frontWheel.position.x + rearWheel.position.x) / 2, 0);
  });

  it("keeps chassis mass within a driveable order of magnitude relative to the wheels", () => {
    const { chassis, frontWheel } = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    // weightKgをそのままdensityに使うとchassisの質量がタイヤの1000倍以上になり、
    // タイヤの駆動力ではほぼ前進できなくなる（回帰防止）。
    expect(chassis.mass / frontWheel.mass).toBeLessThan(100);
  });

  it("scales chassis mass proportionally with weightKg", () => {
    const light = createVehicleBodies(
      { weightKg: 600, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );
    const heavy = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    expect(heavy.chassis.mass).toBeCloseTo(light.chassis.mass * 2, 5);
  });
});
