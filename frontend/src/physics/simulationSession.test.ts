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

  // ゴールタイムの特性テスト（回帰防止）。サスペンション物理モデル再設計（issue #442）前は
  // 33.7秒（段差で減速）だったが、新モデルでは段差を減速せず越えるため、コース長÷試験速度
  // （約32.2秒）に近い値になる。物理モデル・地形を意図して変更する場合のみ範囲を見直すこと。
  it("セダン既定値・smallBump・10m/sのゴールタイムがコース長÷速度（約32秒）に近い", () => {
    const goalEvents = runUntilGoal(createSession("smallBump"));
    const goal = goalEvents[0];
    if (goal?.type !== "goal") throw new Error("goalイベントが発生しませんでした");
    expect(goal.result.elapsedSeconds).toBeGreaterThanOrEqual(31.5);
    expect(goal.result.elapsedSeconds).toBeLessThanOrEqual(33.5);
  });

  it("dispose後は物理ワールドの剛体が空になる", () => {
    const session = createSession("flat");
    expect(session.engine.world.bodies.length).toBeGreaterThan(0);
    session.dispose();
    expect(session.engine.world.bodies).toHaveLength(0);
  });
});
