import { describe, expect, it } from "vitest";
import { sanitizeTestConditions, sanitizeVehicleConfig } from "./parameterRanges";
import { DEFAULT_TEST_CONDITIONS, DEFAULT_VEHICLE } from "./simulationStore";
import { VEHICLE_PRESETS } from "./vehiclePresets";

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
    expect(result.suspension.springConstant).toBe(200000);
    expect(result.tire.diameter).toBeCloseTo(0.4);
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
