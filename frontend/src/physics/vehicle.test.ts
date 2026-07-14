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

  it("shifts the chassis center of mass toward the front when frontWeightRatio is high", () => {
    const { chassis, frontWheel, rearWheel } = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.9, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    // frontWheelはchassisの+X側にあるため、前重心ほどchassisの重心（回転軸）も+X側へ寄る。
    const midpointX = (frontWheel.position.x + rearWheel.position.x) / 2;
    expect(chassis.position.x).toBeGreaterThan(midpointX);
  });

  it("shifts the chassis center of mass toward the rear when frontWeightRatio is low", () => {
    const { chassis, frontWheel, rearWheel } = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.1, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    const midpointX = (frontWheel.position.x + rearWheel.position.x) / 2;
    expect(chassis.position.x).toBeLessThan(midpointX);
  });

  it("keeps the chassis center of mass centered when frontWeightRatio is balanced", () => {
    const { chassis, frontWheel, rearWheel } = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 200000 },
      0,
      0
    );

    const midpointX = (frontWheel.position.x + rearWheel.position.x) / 2;
    expect(chassis.position.x).toBeCloseTo(midpointX, 5);
  });

  it("increases tire restitution as tire stiffness increases", () => {
    const soft = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 50000 },
      0,
      0
    );
    const stiff = createVehicleBodies(
      { weightKg: 1200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      { diameter: 0.6, stiffness: 400000 },
      0,
      0
    );

    expect(stiff.frontWheel.restitution).toBeGreaterThan(soft.frontWheel.restitution);
  });
});
