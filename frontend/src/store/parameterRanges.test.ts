import { describe, expect, it } from "vitest";
import { sanitizeTestConditions, sanitizeVehicleConfig } from "./parameterRanges";
import { DEFAULT_TEST_CONDITIONS, DEFAULT_VEHICLE } from "./simulationStore";
import { VEHICLE_PRESETS } from "./vehiclePresets";
import { computeStaticState } from "../physics/vehicleGeometry";

describe("sanitizeVehicleConfig", () => {
  it("全プリセットは範囲内であり、値が変わらない", () => {
    for (const preset of VEHICLE_PRESETS) {
      expect(sanitizeVehicleConfig(preset.config, DEFAULT_VEHICLE)).toEqual(preset.config);
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, "1200", null, undefined])(
    "有限な数値でない値(%s)はfallbackの値になる",
    (bad) => {
      const result = sanitizeVehicleConfig({ body: { weightKg: bad } }, DEFAULT_VEHICLE);
      expect(result.body.weightKg).toBe(DEFAULT_VEHICLE.body.weightKg);
    }
  );

  it("駆動方式は3種のみ有効で、不正な値・未指定（古い共有URL）はfallbackの駆動方式になる（issue #535）", () => {
    expect(sanitizeVehicleConfig({ body: { driveType: "ff" } }, DEFAULT_VEHICLE).body.driveType).toBe("ff");
    expect(sanitizeVehicleConfig({ body: { driveType: "fr" } }, DEFAULT_VEHICLE).body.driveType).toBe("fr");
    for (const bad of ["rwd", 1, null, undefined]) {
      expect(sanitizeVehicleConfig({ body: { driveType: bad } }, DEFAULT_VEHICLE).body.driveType).toBe(
        DEFAULT_VEHICLE.body.driveType
      );
    }
    expect(sanitizeVehicleConfig({}, DEFAULT_VEHICLE).body.driveType).toBe(DEFAULT_VEHICLE.body.driveType);
  });

  it("範囲外はmin・maxへ丸める", () => {
    const result = sanitizeVehicleConfig(
      { body: { weightKg: 0 }, suspension: { springConstant: 1e9 }, tire: { diameter: -1 } },
      DEFAULT_VEHICLE
    );
    expect(result.body.weightKg).toBe(500);
    expect(result.suspension.springConstant).toBe(300000);
    expect(result.tire.diameter).toBeCloseTo(0.4);
  });

  it("古い共有URLの車高（rideHeight）は、同じ釣り合いの車高になる取り付け位置へ換算して読む（issue #557）", () => {
    const legacy = { suspension: { ...DEFAULT_VEHICLE.suspension, mountHeight: undefined, rideHeight: 0.4 } };
    const result = sanitizeVehicleConfig(legacy, DEFAULT_VEHICLE);
    const state = computeStaticState(result);
    // 換算後の実際の車高は、旧車高に近い（取り付け位置を1cm刻みへ丸めるぶんの差だけ）。
    expect(Math.abs(state.rideHeightM - 0.4)).toBeLessThan(0.01);
    expect(result.suspension).not.toHaveProperty("rideHeight");
  });

  it("換算した取り付け位置が範囲外なら、範囲内へ丸める。取り付け位置が有効なら、旧車高は無視する（issue #557）", () => {
    const tooHigh = sanitizeVehicleConfig({ suspension: { rideHeight: 1.0 } }, DEFAULT_VEHICLE);
    expect(tooHigh.suspension.mountHeight).toBe(0.5);
    const tooLow = sanitizeVehicleConfig({ suspension: { rideHeight: 0.1 } }, DEFAULT_VEHICLE);
    expect(tooLow.suspension.mountHeight).toBe(0);
    const modern = sanitizeVehicleConfig({ suspension: { mountHeight: 0.2, rideHeight: 0.9 } }, DEFAULT_VEHICLE);
    expect(modern.suspension.mountHeight).toBeCloseTo(0.2, 10);
  });

  it("バネ取り付け位置は0〜0.5mへ丸める（issue #557）", () => {
    expect(sanitizeVehicleConfig({ suspension: { mountHeight: 9 } }, DEFAULT_VEHICLE).suspension.mountHeight).toBe(0.5);
    expect(sanitizeVehicleConfig({ suspension: { mountHeight: -1 } }, DEFAULT_VEHICLE).suspension.mountHeight).toBe(0);
  });

  it("入力がオブジェクトでない・欠落している場合はfallbackになり、未知のキーは捨てる", () => {
    expect(sanitizeVehicleConfig(null, DEFAULT_VEHICLE)).toEqual(DEFAULT_VEHICLE);
    expect(sanitizeVehicleConfig("x", DEFAULT_VEHICLE)).toEqual(DEFAULT_VEHICLE);
    const result = sanitizeVehicleConfig({ body: { evil: 1 } }, DEFAULT_VEHICLE);
    expect(result.body).not.toHaveProperty("evil");
  });
});

describe("sanitizeTestConditions", () => {
  it("terrainTypeが6種以外ならfallbackになる", () => {
    expect(sanitizeTestConditions({ terrainType: "x" }, DEFAULT_TEST_CONDITIONS).terrainType).toBe(
      DEFAULT_TEST_CONDITIONS.terrainType
    );
    expect(sanitizeTestConditions({ terrainType: "washboard" }, DEFAULT_TEST_CONDITIONS).terrainType).toBe(
      "washboard"
    );
  });

  it("速度は範囲内へ丸め、NaNはfallbackになる", () => {
    expect(sanitizeTestConditions({ speed: 999 }, DEFAULT_TEST_CONDITIONS).speed).toBe(30);
    expect(sanitizeTestConditions({ speed: Number.NaN }, DEFAULT_TEST_CONDITIONS).speed).toBe(
      DEFAULT_TEST_CONDITIONS.speed
    );
  });
});
