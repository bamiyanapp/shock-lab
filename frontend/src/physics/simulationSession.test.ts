import Matter from "matter-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulationSession, type SimulationEvent } from "./simulationSession";
import { MAX_HISTORY_SAMPLES } from "./units";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import type { TerrainType } from "../types/vehicle";

// ゴールまで走る数千tickの物理計算を含み、カバレッジ計測（計装）下では既定の5秒を超えるため延ばす。
vi.setConfig({ testTimeout: 60_000 });

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

    it("overturned: 一回転（2π）して正しい向きで着地した車体は、転倒とみなさない（issue #519）", () => {
      const session = createSession("flat", 10);
      for (let i = 0; i < 200; i += 1) {
        // 回転数ぶん増え続ける角度。向きは正常（2π・4π）なので、傾きの判定は0と同じになる。
        Matter.Body.setAngle(session.bodies.chassis, i % 2 === 0 ? Math.PI * 2 : Math.PI * 4);
        expect(session.stepForTest().events.some((event) => event.type === "retire" && event.reason === "overturned")).toBe(false);
      }
    });

    it("overturned: 一回転半して逆さ（3π）のままなら、転倒として発火する", () => {
      const session = createSession("flat", 10);
      for (let i = 0; i < 400 && !session.hasFinished; i += 1) {
        Matter.Body.setAngle(session.bodies.chassis, Math.PI * 3);
        const retire = session.stepForTest().events.find((event) => event.type === "retire");
        if (retire?.type === "retire") {
          expect(retire.reason).toBe("overturned");
          return;
        }
      }
      throw new Error("overturnedで終了しませんでした");
    });

    it("停止状態から加速し、目標速度に達すると、それ以上は加速しない（issue #516）", () => {
      const session = createSession("flat", 10);
      const speedAfter = (ticks: number) => {
        let speed = 0;
        for (let i = 0; i < ticks; i += 1) speed = session.stepForTest().speedMetersPerSecond;
        return speed;
      };
      expect(speedAfter(1)).toBeLessThan(1);
      const after1s = speedAfter(59);
      expect(after1s).toBeGreaterThan(3);
      expect(after1s).toBeLessThan(5);
      const after5s = speedAfter(240);
      expect(after5s).toBeGreaterThan(9.5);
      expect(after5s).toBeLessThan(10.5);
    });

    // 目標速度に達した後の最低速度(m/s)。段差・斜面で落ちた速度を見る。
    function minSpeedAfterReachingTarget(terrain: TerrainType): number {
      const session = createSession(terrain, 10);
      let reachedTarget = false;
      let minSpeed = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 60 * 25; i += 1) {
        const { speedMetersPerSecond } = session.stepForTest();
        if (speedMetersPerSecond > 9.95) reachedTarget = true;
        if (reachedTarget) minSpeed = Math.min(minSpeed, speedMetersPerSecond);
      }
      expect(reachedTarget).toBe(true);
      return minSpeed;
    }

    it("段差に乗り上げると、速度が目標より落ちる。平坦路では落ちない（issue #516）", () => {
      expect(minSpeedAfterReachingTarget("flat")).toBeGreaterThan(9.9);
      expect(minSpeedAfterReachingTarget("largeBump")).toBeLessThan(9.5);
    });

    it("急な斜面（ジャンプ台）では、速度が大きく落ちる（issue #516）", () => {
      expect(minSpeedAfterReachingTarget("jumpRamp")).toBeLessThan(5);
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

  describe("グラフ用の履歴（issue #447）", () => {
    it("600tick進めると履歴が100件（6tickごと＝10Hz）になり、sampleは6tickごとにだけ返る", () => {
      const session = createSession("flat", 10);
      let sampleCount = 0;
      for (let i = 0; i < 600; i += 1) {
        if (session.stepForTest().sample) sampleCount += 1;
      }
      expect(session.history).toHaveLength(100);
      expect(sampleCount).toBe(100);
      expect(session.history[99].timeSec).toBeCloseTo(10, 5);
    });

    it("距離は走行とともに増え、latestMetricsが直近tickの値を指す", () => {
      const session = createSession("flat", 10);
      let last = session.stepForTest();
      for (let i = 0; i < 59; i += 1) last = session.stepForTest();
      expect(session.latestMetrics).toBe(last.metrics);
      // 停止状態から4m/s²で加速するため、1秒後の距離は約2m（目標速度で走り続けた場合の10mより短い）。
      const distanceM = session.history[session.history.length - 1].distanceM;
      expect(distanceM).toBeGreaterThan(1.5);
      expect(distanceM).toBeLessThan(3);
    });

    it("区間内で1tickだけのピークは、間引き後のサンプルに残る", () => {
      const session = createSession("flat", 0);
      for (let i = 0; i < 6 * 20; i += 1) session.stepForTest();
      const before = session.history.length;
      // 区間（6tick）の途中で車体へ上向きの速度を1回だけ与え、鋭いピークを作る
      session.stepForTest();
      Matter.Body.setVelocity(session.bodies.chassis, { x: 0, y: -3 });
      for (let i = 0; i < 12; i += 1) session.stepForTest();
      const peak = Math.max(...session.history.slice(before).map((sample) => Math.abs(sample.verticalG)));
      expect(peak).toBeGreaterThan(0.2);
    });

    it("3001件目で先頭が捨てられる", () => {
      const session = createSession("flat", 0);
      for (let i = 0; i < MAX_HISTORY_SAMPLES * 6 + 6; i += 1) session.stepForTest();
      expect(session.history).toHaveLength(MAX_HISTORY_SAMPLES);
      expect(session.history[0].timeSec).toBeCloseTo(0.2, 5);
    });
  });
});
