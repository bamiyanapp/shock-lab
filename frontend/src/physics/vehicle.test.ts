import { describe, expect, it } from "vitest";
import { createVehicleBodies, getAxleArmsPx, getSprungMassKg } from "./vehicle";
import { MASS_SCALE, UNSPRUNG_MASS_KG } from "./units";
import type { VehicleBodyParams } from "../types/vehicle";

const suspension = { springConstant: 30000, damperCoefficient: 3000, strokeLength: 0.15, rideHeight: 0.4 };
const tire = { diameter: 0.6, stiffness: 200000 };
const body = (overrides: Partial<VehicleBodyParams> = {}): VehicleBodyParams => ({
  weightKg: 1200,
  frontWeightRatio: 0.5,
  centerOfGravityHeight: 0.5,
  wheelbase: 2.5,
  ...overrides,
});
const create = (b: VehicleBodyParams, t = tire) => createVehicleBodies(b, t, suspension, 0, 300);

describe("createVehicleBodies", () => {
  it("places the front wheel ahead of the rear wheel along the x axis", () => {
    const { frontWheel, rearWheel } = create(body());
    expect(frontWheel.position.x).toBeGreaterThan(rearWheel.position.x);
    expect(frontWheel.position.x - rearWheel.position.x).toBeCloseTo(2.5 * 60, 5);
  });

  it("starts at rest: tires touch the ground and the chassis sits at the suspension rest length", () => {
    const { chassis, frontWheel } = create(body());
    expect(frontWheel.position.y + (frontWheel.circleRadius ?? 0)).toBeCloseTo(300, 5);
    expect(frontWheel.position.y - chassis.position.y).toBeCloseTo(0.4 * 60, 5);
  });

  it("sets masses explicitly: sprung mass on the chassis, a fixed unsprung mass per wheel", () => {
    const { chassis, frontWheel, rearWheel } = create(body());
    expect(chassis.mass).toBeCloseTo(getSprungMassKg(1200) * MASS_SCALE, 8);
    expect(frontWheel.mass).toBeCloseTo(UNSPRUNG_MASS_KG * MASS_SCALE, 8);
    expect(rearWheel.mass).toBeCloseTo(UNSPRUNG_MASS_KG * MASS_SCALE, 8);
  });

  it("scales the sprung mass with weightKg", () => {
    const light = create(body({ weightKg: 660 }));
    const heavy = create(body({ weightKg: 1160 }));
    expect(heavy.chassis.mass / light.chassis.mass).toBeCloseTo(1000 / 500, 5);
  });

  it("puts the center of mass closer to the front axle when frontWeightRatio is high", () => {
    const arms = getAxleArmsPx(body({ frontWeightRatio: 0.7 }));
    expect(arms.front).toBeLessThan(arms.rear);
    expect(arms.front + arms.rear).toBeCloseTo(2.5 * 60, 5);
    const { chassis, frontWheel, rearWheel } = create(body({ frontWeightRatio: 0.7 }));
    expect(frontWheel.position.x - chassis.position.x).toBeLessThan(chassis.position.x - rearWheel.position.x);
  });

  it("does not collide the chassis and the wheels with each other (same negative collision group)", () => {
    const { chassis, frontWheel, rearWheel } = create(body());
    expect(chassis.collisionFilter.group).toBeLessThan(0);
    expect(frontWheel.collisionFilter.group).toBe(chassis.collisionFilter.group);
    expect(rearWheel.collisionFilter.group).toBe(chassis.collisionFilter.group);
  });

  it("approximates the wheel as a many-sided polygon that still reports its circleRadius", () => {
    const { frontWheel } = create(body());
    expect(frontWheel.circleRadius).toBeCloseTo(18, 5);
    expect(frontWheel.vertices.length).toBeGreaterThanOrEqual(90);
  });

  it("increases tire restitution as tire stiffness increases", () => {
    const soft = create(body(), { diameter: 0.6, stiffness: 50000 });
    const stiff = create(body(), { diameter: 0.6, stiffness: 400000 });
    expect(stiff.frontWheel.restitution).toBeGreaterThan(soft.frontWheel.restitution);
  });
});
