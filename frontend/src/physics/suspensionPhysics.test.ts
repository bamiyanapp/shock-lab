import Matter from "matter-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulationSession } from "./simulationSession";
import { createWorld } from "./world";
import { computeSuspensionTheory } from "./suspensionTheory";
import { PARAMETER_RANGES } from "../store/parameterRanges";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import type { TerrainType, VehicleConfig } from "../types/vehicle";

// サスペンション物理モデル（docs/physics-model.md・issue #442）の受け入れテスト。
// 数値は設計で固定したもので、実装側を合わせる。期待値を実装に合わせて緩めてはならない。

// 数千tickの物理計算を含み、カバレッジ計測（計装）下では既定の5秒を超えるため延ばす。
vi.setConfig({ testTimeout: 60_000 });

const SEDAN = VEHICLE_PRESETS[0].config;
const sessions: SimulationSession[] = [];

function config(overrides: { suspension?: Partial<VehicleConfig["suspension"]> } = {}): VehicleConfig {
  return { ...SEDAN, suspension: { ...SEDAN.suspension, ...overrides.suspension } };
}

function createSession(vehicle: VehicleConfig, terrainType: TerrainType, speed: number) {
  const session = new SimulationSession({ vehicle, terrainType, getSpeed: () => speed, random: () => 0.5 });
  sessions.push(session);
  return session;
}

function runToGoal(session: SimulationSession, maxTicks = 4000) {
  for (let i = 0; i < maxTicks; i += 1) {
    const goal = session.stepForTest().events.find((event) => event.type === "goal");
    if (goal?.type === "goal") return goal.result;
  }
  throw new Error("goalに到達しませんでした");
}

/** 車体をlift[m]持ち上げて離し、tickごとの静止位置からのずれ[m]（上が正）を返す */
function dropFromLift(vehicle: VehicleConfig, liftM: number, ticks: number): number[] {
  const session = createSession(vehicle, "flat", 0);
  const { chassis } = session.bodies;
  const restY = chassis.position.y;
  Matter.Body.setPosition(chassis, { x: chassis.position.x, y: restY - liftM * 60 });
  const offsets: number[] = [];
  for (let i = 0; i < ticks; i += 1) {
    session.stepForTest();
    offsets.push((restY - chassis.position.y) / 60);
  }
  return offsets;
}

describe("サスペンション物理モデル", () => {
  afterEach(() => {
    sessions.splice(0).forEach((session) => session.dispose());
  });

  it("1. 重力: 自由落下60tick（1秒）の落下距離が294px±5%", () => {
    const engine = createWorld();
    const body = Matter.Bodies.circle(0, 0, 10, { frictionAir: 0 });
    Matter.World.add(engine.world, body);
    for (let i = 0; i < 60; i += 1) Matter.Engine.update(engine, 1000 / 60);
    expect(Math.abs(body.position.y - 294) / 294).toBeLessThan(0.05);
  });

  it("2. 静止: セダン既定値・flat・速度0で180tick後、前後とも圧縮量が0付近でGも小さい", () => {
    const session = createSession(SEDAN, "flat", 0);
    const recentAbsG: number[] = [];
    let last = session.stepForTest().metrics;
    for (let i = 1; i < 180; i += 1) {
      last = session.stepForTest().metrics;
      if (i >= 120) recentAbsG.push(Math.abs(last.verticalG));
    }
    expect(Math.abs(last.suspensionStroke)).toBeLessThan(0.01);
    expect(Math.abs(last.rearSuspensionStroke)).toBeLessThan(0.01);
    expect(recentAbsG.reduce((a, b) => a + b, 0) / recentAbsG.length).toBeLessThan(0.02);
  });

  it("3. 平坦路: セダン既定値・flat・10m/sでゴールまで、平均G<0.05・最大衝撃<0.3・底付き0回", () => {
    const result = runToGoal(createSession(SEDAN, "flat", 10));
    expect(result.averageAbsVerticalG).toBeLessThan(0.05);
    expect(result.maxImpact).toBeLessThan(0.3);
    expect(result.bottomOutCount).toBe(0);
  });

  it("4. 固有振動数: ダンパー100で車体を0.05m持ち上げて離すと、周期が理論値の±20%以内", () => {
    const offsets = dropFromLift(config({ suspension: { damperCoefficient: 100 } }), 0.05, 400);
    const crossings: number[] = [];
    for (let i = 1; i < offsets.length; i += 1) {
      if (offsets[i - 1] > 0 !== offsets[i] > 0) crossings.push(i);
    }
    expect(crossings.length).toBeGreaterThanOrEqual(5);
    const halfPeriods = crossings.length - 1;
    const periodSeconds = ((crossings[halfPeriods] - crossings[0]) / halfPeriods) * 2 / 60;
    const { naturalFrequencyHz } = computeSuspensionTheory(30000, 100, 1200);
    expect(Math.abs(periodSeconds - 1 / naturalFrequencyHz) / (1 / naturalFrequencyHz)).toBeLessThan(0.2);
  });

  it("5. 減衰の単調性: ダンパー3000は1000より、振幅が初期の10%未満になるまでのtick数が少ない", () => {
    const settleTicks = (damperCoefficient: number) => {
      const offsets = dropFromLift(config({ suspension: { damperCoefficient } }), 0.05, 900);
      const lastLarge = offsets.reduce((last, value, index) => (Math.abs(value) >= 0.005 ? index : last), -1);
      return lastLarge + 1;
    };
    expect(settleTicks(3000)).toBeLessThan(settleTicks(1000));
  });

  it("6. 底付き: hugeSpeedBumpでバネ5000は底付き1回以上、strokeLengthを0.30にしても底付き回数は増えない", () => {
    const bottomOuts = (suspension: Partial<VehicleConfig["suspension"]>) => {
      const session = createSession(config({ suspension }), "hugeSpeedBump", 10);
      let count = 0;
      for (let i = 0; i < 1500; i += 1) count = session.stepForTest().metrics.bottomOutCount;
      return count;
    };
    const soft = bottomOuts({ springConstant: 5000 });
    expect(soft).toBeGreaterThanOrEqual(1);
    expect(bottomOuts({ springConstant: 5000, strokeLength: 0.3 })).toBeLessThanOrEqual(soft);
    expect(bottomOuts({ strokeLength: 0.3 })).toBeLessThanOrEqual(bottomOuts({ strokeLength: 0.15 }));
  });

  it("7. 飽和なし: smallBumpでバネ100000と200000、ダンパー10000と20000の最大衝撃が異なる", () => {
    const maxImpact = (suspension: Partial<VehicleConfig["suspension"]>) =>
      runToGoal(createSession(config({ suspension }), "smallBump", 10)).maxImpact;
    expect(maxImpact({ springConstant: 100000 })).not.toBeCloseTo(maxImpact({ springConstant: 200000 }), 3);
    expect(maxImpact({ damperCoefficient: 10000 })).not.toBeCloseTo(maxImpact({ damperCoefficient: 20000 }), 3);
  });

  describe("8. 全域で破綻しない（600tick進めても位置・メトリクスにNaN・Infinityが出ない）", () => {
    const expectFinite = (vehicle: VehicleConfig, terrainType: TerrainType) => {
      const session = createSession(vehicle, terrainType, 10);
      for (let i = 0; i < 600; i += 1) {
        const { metrics } = session.stepForTest();
        const values = [
          session.bodies.chassis.position.x,
          session.bodies.chassis.position.y,
          session.bodies.chassis.angle,
          ...Object.values(metrics).filter((value): value is number => typeof value === "number"),
        ];
        expect(values.every(Number.isFinite)).toBe(true);
      }
    };

    it.each(VEHICLE_PRESETS.flatMap((preset) => (["flat", "smallBump"] as const).map((t) => [preset.id, t] as const)))(
      "プリセット %s・%s",
      (presetId, terrain) => {
        const preset = VEHICLE_PRESETS.find((candidate) => candidate.id === presetId);
        if (!preset) throw new Error("preset not found");
        expectFinite(preset.config, terrain);
      }
    );

    const sliderCases = (
      [
        ["body", "weightKg"],
        ["body", "frontWeightRatio"],
        ["body", "centerOfGravityHeight"],
        ["body", "wheelbase"],
        ["suspension", "springConstant"],
        ["suspension", "damperCoefficient"],
        ["suspension", "strokeLength"],
        ["suspension", "rideHeight"],
        ["tire", "diameter"],
        ["tire", "stiffness"],
      ] as const
    ).flatMap(([group, key]) => (["min", "max"] as const).map((edge) => [group, key, edge] as const));

    it.each(sliderCases)("スライダー %s.%s の%s", (group, key, edge) => {
      const vehicle = structuredClone(SEDAN) as VehicleConfig;
      (vehicle[group] as unknown as Record<string, number>)[key] = PARAMETER_RANGES[key][edge];
      expectFinite(vehicle, "smallBump");
    });
  });

  it("9. ストロークは常に-strokeLength〜+strokeLengthの範囲内", () => {
    for (const terrain of ["smallBump", "hugeSpeedBump"] as const) {
      const session = createSession(SEDAN, terrain, 10);
      for (let i = 0; i < 900; i += 1) {
        const { metrics } = session.stepForTest();
        const limit = SEDAN.suspension.strokeLength + 1e-6;
        expect(Math.abs(metrics.suspensionStroke)).toBeLessThanOrEqual(limit);
        expect(Math.abs(metrics.rearSuspensionStroke)).toBeLessThanOrEqual(limit);
      }
    }
  });
});
