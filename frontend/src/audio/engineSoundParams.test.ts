import { describe, expect, it } from "vitest";
import {
  ENGINE_PROFILES,
  HARMONIC_ORDERS,
  computeEngineSoundParams,
  selectEngineProfile,
} from "./engineSoundParams";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";

const SEDAN = ENGINE_PROFILES.sedan;

describe("computeEngineSoundParams（issue #511）", () => {
  it("止まっているときは、アイドルの回転数で、1速", () => {
    const params = computeEngineSoundParams(0, SEDAN);
    expect(params.rpm).toBe(SEDAN.idleRpm);
    expect(params.gear).toBe(1);
  });

  it("同じギアの中では、速度が上がると、回転数が上がる", () => {
    const slow = computeEngineSoundParams(2, SEDAN);
    const fast = computeEngineSoundParams(5, SEDAN);
    expect(slow.gear).toBe(1);
    expect(fast.gear).toBe(1);
    expect(fast.rpm).toBeGreaterThan(slow.rpm);
  });

  it("上のギアへ入ると、回転数がいったん落ちる（シフトアップ）", () => {
    const [firstTop] = SEDAN.gearTopSpeedsMps;
    const beforeShift = computeEngineSoundParams(firstTop, SEDAN);
    const afterShift = computeEngineSoundParams(firstTop + 0.1, SEDAN);
    expect(afterShift.gear).toBe(beforeShift.gear + 1);
    expect(afterShift.rpm).toBeLessThan(beforeShift.rpm);
  });

  it("速度が、全体として上がると、ギアも上がる。回転数は、範囲を超えない", () => {
    let lastGear = 0;
    for (let speed = 0; speed <= 60; speed += 0.5) {
      const params = computeEngineSoundParams(speed, SEDAN);
      expect(params.gear).toBeGreaterThanOrEqual(lastGear);
      expect(params.rpm).toBeGreaterThanOrEqual(SEDAN.idleRpm);
      expect(params.rpm).toBeLessThanOrEqual(SEDAN.redlineRpm);
      lastGear = params.gear;
    }
    expect(computeEngineSoundParams(1000, SEDAN).rpm).toBe(SEDAN.redlineRpm);
  });

  it("負の速度（後退）も、絶対値として扱う", () => {
    expect(computeEngineSoundParams(-10, SEDAN)).toEqual(computeEngineSoundParams(10, SEDAN));
  });

  it("基音の周波数は、点火周波数（回転数 ÷ 60 × 1回転あたりの点火回数）の2・3・4倍", () => {
    const params = computeEngineSoundParams(8, SEDAN);
    expect(params.firingHz).toBeCloseTo((params.rpm / 60) * SEDAN.firingPerRev, 10);
    HARMONIC_ORDERS.forEach((order, index) => {
      expect(params.oscillatorHz[index]).toBeCloseTo(params.firingHz * order, 10);
    });
  });

  it("ローパスのカットオフは、回転数に連動して上がる。範囲に収まる", () => {
    const idle = computeEngineSoundParams(0, SEDAN);
    const fast = computeEngineSoundParams(30, SEDAN);
    expect(fast.cutoffHz).toBeGreaterThan(idle.cutoffHz);
    for (const profile of Object.values(ENGINE_PROFILES)) {
      const { cutoffHz } = computeEngineSoundParams(20, profile);
      expect(cutoffHz).toBeGreaterThanOrEqual(300);
      expect(cutoffHz).toBeLessThanOrEqual(6000);
    }
  });

  it("ノイズは、速度で増え、揺れ（上下G）で、さらに増える。0〜1に収まる", () => {
    const still = computeEngineSoundParams(0, SEDAN).noiseGain;
    const fast = computeEngineSoundParams(30, SEDAN).noiseGain;
    const rough = computeEngineSoundParams(30, SEDAN, 1).noiseGain;
    expect(fast).toBeGreaterThan(still);
    expect(rough).toBeGreaterThan(fast);
    expect(computeEngineSoundParams(100, SEDAN, 100).noiseGain).toBe(1);
    expect(computeEngineSoundParams(0, SEDAN).noiseBandHz).toBeLessThan(computeEngineSoundParams(30, SEDAN).noiseBandHz);
  });

  it("車種で、音が違う: トラックは基音が低く、スポーツカーは高い", () => {
    const at = (id: string) => computeEngineSoundParams(15, ENGINE_PROFILES[id]).firingHz;
    expect(at("truck")).toBeLessThan(at("sedan"));
    expect(at("sedan")).toBeLessThan(at("sports-car"));
    // アイドルでも、トラックはセダンより低い
    expect(computeEngineSoundParams(0, ENGINE_PROFILES.truck).firingHz).toBeLessThan(computeEngineSoundParams(0, SEDAN).firingHz);
  });

  it("全てのプリセットに、エンジン音の特徴があり、ギアの上限速度は、増えていく", () => {
    for (const preset of VEHICLE_PRESETS) {
      const profile = ENGINE_PROFILES[preset.id];
      expect(profile, preset.id).toBeDefined();
      const tops = profile.gearTopSpeedsMps;
      tops.forEach((top, index) => {
        if (index > 0) expect(top).toBeGreaterThan(tops[index - 1]);
      });
    }
  });
});

describe("selectEngineProfile", () => {
  it("プリセットと一致する車両は、そのプリセットの特徴を使う", () => {
    for (const preset of VEHICLE_PRESETS) {
      expect(selectEngineProfile(preset.config)).toBe(ENGINE_PROFILES[preset.id]);
    }
  });

  it("カスタムの車両は、車重が近いプリセットの特徴を使う", () => {
    const heavy = { ...VEHICLE_PRESETS[0].config, body: { ...VEHICLE_PRESETS[0].config.body, weightKg: 9000 } };
    const light = { ...VEHICLE_PRESETS[0].config, body: { ...VEHICLE_PRESETS[0].config.body, weightKg: 700 } };
    expect(selectEngineProfile(heavy)).toBe(ENGINE_PROFILES.truck);
    expect(selectEngineProfile(light)).toBe(ENGINE_PROFILES["kei-car"]);
  });
});
