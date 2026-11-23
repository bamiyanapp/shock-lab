import { describe, expect, it } from "vitest";
import {
  FREE_LENGTH_BASE_M,
  computeAnchorOffsetsPx,
  computeFreeLengthM,
  computeStaticState,
} from "./vehicleGeometry";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import type { VehicleConfig } from "../types/vehicle";

const SEDAN = VEHICLE_PRESETS[0].config;
const withSuspension = (overrides: Partial<VehicleConfig["suspension"]>, weightKg = SEDAN.body.weightKg): VehicleConfig => ({
  ...SEDAN,
  body: { ...SEDAN.body, weightKg },
  suspension: { ...SEDAN.suspension, ...overrides },
});

describe("computeFreeLengthM", () => {
  it("自由長 = 基準 + バネ取り付け位置 + ストローク量", () => {
    expect(computeFreeLengthM(0, 0.05)).toBeCloseTo(FREE_LENGTH_BASE_M + 0.05, 10);
    expect(computeFreeLengthM(0.5, 0.4)).toBeCloseTo(0.95, 10);
  });

  it("既定のセダン（取り付け位置0.19m・ストローク0.25m）は、自由長0.49m", () => {
    expect(computeFreeLengthM(0.19, 0.25)).toBeCloseTo(0.49, 10);
  });

  it("5種のプリセットの自由長は、ストローク量を連動させる前と同じ（物理の結果を変えない。issue #569）", () => {
    const expected = [0.49, 0.49, 0.3, 0.68, 0.78];
    VEHICLE_PRESETS.forEach((preset, index) => {
      const { mountHeight, strokeLength } = preset.config.suspension;
      expect(computeFreeLengthM(mountHeight, strokeLength)).toBeCloseTo(expected[index], 10);
    });
  });
});

describe("computeStaticState（issue #557）", () => {
  it("ストローク量を上げると、バネが長くなり、実際の車高が上がる（issue #569）", () => {
    const short = computeStaticState(withSuspension({ strokeLength: 0.2 }));
    const long = computeStaticState(withSuspension({ strokeLength: 0.3 }));
    expect(long.freeLengthM - short.freeLengthM).toBeCloseTo(0.1, 10);
    expect(long.rideHeightM - short.rideHeightM).toBeCloseTo(0.1, 10);
  });

  it("静止時のたわみ = ばね上質量×荷重配分×重力 ÷ (2×バネ定数)", () => {
    const state = computeStaticState(SEDAN);
    // ばね上質量 1040kg、前0.55。1040 × 0.55 × 9.8 ÷ 60000
    expect(state.sagFrontM).toBeCloseTo((1040 * 0.55 * 9.8) / 60000, 10);
    expect(state.sagRearM).toBeCloseTo((1040 * 0.45 * 9.8) / 60000, 10);
  });

  it("実際の車高 = 自由長 − たわみ（前後の平均）", () => {
    const state = computeStaticState(SEDAN);
    expect(state.heightFrontM).toBeCloseTo(state.freeLengthM - state.sagFrontM, 10);
    expect(state.rideHeightM).toBeCloseTo((state.heightFrontM + state.heightRearM) / 2, 10);
  });

  it("取り付け位置を上げると、実際の車高が同じ量だけ上がる", () => {
    const low = computeStaticState(withSuspension({ mountHeight: 0.1 }));
    const high = computeStaticState(withSuspension({ mountHeight: 0.3 }));
    expect(high.rideHeightM - low.rideHeightM).toBeCloseTo(0.2, 10);
  });

  it("バネ定数が低いほど、車重が重いほど、たわみが大きく、車高が低い", () => {
    const base = computeStaticState(SEDAN);
    expect(computeStaticState(withSuspension({ springConstant: 15000 })).sagFrontM).toBeGreaterThan(base.sagFrontM);
    expect(computeStaticState(withSuspension({}, 2400)).rideHeightM).toBeLessThan(base.rideHeightM);
  });

  it("全プリセットは、初めから底付きにならない", () => {
    for (const preset of VEHICLE_PRESETS) {
      expect(computeStaticState(preset.config).isBottomedOutAtStart).toBe(false);
    }
  });

  it("低いバネ定数・重い車重では、初めから底付きになる", () => {
    expect(computeStaticState(withSuspension({ springConstant: 5000 }, 5000)).isBottomedOutAtStart).toBe(true);
    expect(computeStaticState(withSuspension({ strokeLength: 0.05 })).isBottomedOutAtStart).toBe(true);
  });

  it("ストロークを増やすと、初めから底付きの設定が走れるようになる", () => {
    const stiffless = { springConstant: 10000 };
    expect(computeStaticState(withSuspension({ ...stiffless, strokeLength: 0.25 })).isBottomedOutAtStart).toBe(true);
    expect(computeStaticState(withSuspension({ ...stiffless, strokeLength: 0.5 })).isBottomedOutAtStart).toBe(false);
  });
});

describe("computeAnchorOffsetsPx", () => {
  it("前後のたわみの差を、取り付け点の縦のずれとして吸収する（前軸のほうが沈む車は、前の取り付け点が低い）", () => {
    const offsets = computeAnchorOffsetsPx(computeStaticState(SEDAN));
    expect(offsets.front).toBeGreaterThan(0);
    expect(offsets.rear).toBeLessThan(0);
    expect(offsets.front + offsets.rear).toBeCloseTo(0, 10);
  });

  it("前後の荷重が等しければ、ずれは0", () => {
    const even = { ...SEDAN, body: { ...SEDAN.body, frontWeightRatio: 0.5 } };
    const offsets = computeAnchorOffsetsPx(computeStaticState(even));
    expect(offsets.front).toBeCloseTo(0, 10);
    expect(offsets.rear).toBeCloseTo(0, 10);
  });
});
