import { afterEach, describe, expect, it } from "vitest";
import { SimulationSession, type SimulationEvent } from "./simulationSession";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import type { TerrainType } from "../types/vehicle";

const MAX_STEPS = 3000 * 60;
const sessions: SimulationSession[] = [];

function createSession(terrainType: TerrainType, speed = 10) {
  const session = new SimulationSession({
    vehicle: VEHICLE_PRESETS[0].config,
    terrainType,
    getSpeed: () => speed,
    random: () => 0.5,
  });
  sessions.push(session);
  return session;
}

function runUntilGoal(session: SimulationSession): SimulationEvent[] {
  const goalEvents: SimulationEvent[] = [];
  for (let i = 0; i < MAX_STEPS && goalEvents.length === 0; i += 1) {
    goalEvents.push(...session.stepForTest().events.filter((event) => event.type === "goal"));
  }
  return goalEvents;
}

describe("SimulationSession", () => {
  afterEach(() => {
    sessions.splice(0).forEach((session) => session.dispose());
  });

  it("同じ条件・同じ乱数源なら同じ結果になる（決定性）", () => {
    const a = createSession("smallBump");
    const b = createSession("smallBump");
    for (let i = 0; i < 600; i += 1) {
      a.stepForTest();
      b.stepForTest();
    }
    expect(a.bodies.chassis.position).toEqual(b.bodies.chassis.position);
  });

  it("平坦路をゴールまで走るとgoalイベントがちょうど1回発生する", () => {
    const session = createSession("flat");
    const goalEvents = runUntilGoal(session);
    expect(goalEvents).toHaveLength(1);
    // ゴール後にさらに進めても再発火しない
    for (let i = 0; i < 120; i += 1) {
      expect(session.stepForTest().events.filter((event) => event.type === "goal")).toHaveLength(0);
    }
    expect(session.hasReachedGoal).toBe(true);
  });

  // リファクタリング前（VehicleCanvasの実装）で計測した値（33.7秒）との一致を確認する特性テスト。
  // 物理モデルを意図して変更する場合のみ、この範囲を見直すこと。
  it("セダン既定値・smallBump・10m/sのゴールタイムが従来の実測値（約33.7秒）の範囲に入る", () => {
    const goalEvents = runUntilGoal(createSession("smallBump"));
    const goal = goalEvents[0];
    if (goal?.type !== "goal") throw new Error("goalイベントが発生しませんでした");
    expect(goal.result.elapsedSeconds).toBeGreaterThanOrEqual(33);
    expect(goal.result.elapsedSeconds).toBeLessThanOrEqual(35);
  });

  it("dispose後は物理ワールドの剛体が空になる", () => {
    const session = createSession("flat");
    expect(session.engine.world.bodies.length).toBeGreaterThan(0);
    session.dispose();
    expect(session.engine.world.bodies).toHaveLength(0);
  });
});
