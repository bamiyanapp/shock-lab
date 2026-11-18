import Matter from "matter-js";
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

  describe("リタイア判定（issue #443）", () => {
    function retireEvents(session: SimulationSession, maxTicks: number) {
      for (let i = 0; i < maxTicks; i += 1) {
        const retire = session.stepForTest().events.find((event) => event.type === "retire");
        if (retire?.type === "retire") return { retire, tick: i + 1 };
      }
      return null;
    }

    it("overturned: 車体の傾きがπ/2を超えた状態が連続120tick続くと発火する", () => {
      const session = createSession("flat", 10);
      for (let i = 0; i < 400 && !session.hasFinished; i += 1) {
        Matter.Body.setAngle(session.bodies.chassis, Math.PI * 0.8);
        const retire = session.stepForTest().events.find((event) => event.type === "retire");
        if (retire?.type === "retire") {
          expect(retire.reason).toBe("overturned");
          expect(retire.result.outcome).toBe("retire");
          expect(retire.result.rank).toBeNull();
          expect(session.animationTickCount).toBeGreaterThanOrEqual(120);
          expect(session.animationTickCount).toBeLessThan(130);
          return;
        }
      }
      throw new Error("overturnedで終了しませんでした");
    });

    it("overturned: 傾きが途中で戻ると連続カウントはリセットされ、発火しない", () => {
      const session = createSession("flat", 10);
      for (let i = 0; i < 119; i += 1) {
        Matter.Body.setAngle(session.bodies.chassis, Math.PI * 0.8);
        session.stepForTest();
      }
      Matter.Body.setAngle(session.bodies.chassis, 0);
      session.stepForTest();
      for (let i = 0; i < 119; i += 1) {
        Matter.Body.setAngle(session.bodies.chassis, Math.PI * 0.8);
        expect(session.stepForTest().events.some((event) => event.type === "retire")).toBe(false);
      }
    });

    it("stuck: 速度0で5秒(300tick)前進できないと、300tick目以降に発火する（開始直後は判定しない）", () => {
      const session = createSession("flat", 0);
      const found = retireEvents(session, 400);
      expect(found?.retire.reason).toBe("stuck");
      expect(found?.tick).toBeGreaterThan(300);
      expect(found?.retire.result.distanceMeters).toBeLessThan(0.5);
    });

    it("fellOff: 車体が地面より600px以上下へ落ちると発火する", () => {
      const session = createSession("flat", 10);
      session.stepForTest();
      Matter.Body.setPosition(session.bodies.chassis, { x: 400, y: 300 + 700 });
      const retire = session.stepForTest().events.find((event) => event.type === "retire");
      expect(retire?.type === "retire" && retire.reason).toBe("fellOff");
    });

    it("timeout: 走行tickが上限を超えると発火する（上限は引数で短くできる）", () => {
      const session = new SimulationSession({
        vehicle: VEHICLE_PRESETS[0].config,
        terrainType: "flat",
        getSpeed: () => 10,
        random: () => 0.5,
        timeoutTicks: 60,
      });
      sessions.push(session);
      const found = retireEvents(session, 200);
      expect(found?.retire.reason).toBe("timeout");
      expect(found?.tick).toBe(61);
    });

    it("終了後は再度発火せず、ゴールしてもretireイベントは出ない", () => {
      const session = createSession("flat", 0);
      expect(retireEvents(session, 400)).not.toBeNull();
      for (let i = 0; i < 400; i += 1) {
        expect(session.stepForTest().events.some((event) => event.type === "retire" || event.type === "goal")).toBe(false);
      }
      const goalSession = createSession("flat", 10);
      runUntilGoal(goalSession);
      for (let i = 0; i < 600; i += 1) {
        expect(goalSession.stepForTest().events.some((event) => event.type === "retire")).toBe(false);
      }
    });
  });
});
