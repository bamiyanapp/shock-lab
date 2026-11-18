import { describe, expect, it, beforeEach } from "vitest";
import { useSimulationStore } from "./simulationStore";

describe("useSimulationStore", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("merges partial vehicle updates without discarding other fields", () => {
    const before = useSimulationStore.getState().vehicle;
    useSimulationStore.getState().setVehicle({ body: { ...before.body, weightKg: 2000 } });

    const after = useSimulationStore.getState().vehicle;
    expect(after.body.weightKg).toBe(2000);
    expect(after.body.wheelbase).toBe(before.body.wheelbase);
    expect(after.suspension).toEqual(before.suspension);
  });

  it("appends metrics to history and caps it at 200 entries", () => {
    for (let i = 0; i < 250; i += 1) {
      useSimulationStore.getState().setMetrics({
        speed: i,
        suspensionStroke: 0,
        rearSuspensionStroke: 0,
        verticalG: 0,
        maxImpact: 0,
        isBottomedOut: false,
        bottomOutCount: 0,
      });
    }

    const { metricsHistory, metrics } = useSimulationStore.getState();
    expect(metricsHistory).toHaveLength(200);
    expect(metrics.speed).toBe(249);
    expect(metricsHistory[metricsHistory.length - 1].speed).toBe(249);
  });

  const result = {
    outcome: "goal" as const,
    rank: "A" as const,
    maxImpact: 2.5,
    bottomOutCount: 1,
    averageAbsVerticalG: 0.4,
    elapsedSeconds: 12.3,
    distanceMeters: 190,
  };
  const phase = () => useSimulationStore.getState().phase;

  describe("走行状態の遷移（issue #443）", () => {
    it("idle → running → paused → running → finished", () => {
      const store = useSimulationStore.getState();
      expect(phase()).toBe("idle");
      store.startRun();
      expect(phase()).toBe("running");
      store.pauseRun();
      expect(phase()).toBe("paused");
      store.resumeRun();
      expect(phase()).toBe("running");
      store.finishRun(result);
      expect(phase()).toBe("finished");
      expect(useSimulationStore.getState().result).toEqual(result);
    });

    it("許可されない遷移は無視する（idleで再開、pausedで開始、終了後の一時停止）", () => {
      const store = useSimulationStore.getState();
      store.resumeRun();
      expect(phase()).toBe("idle");
      store.finishRun(result);
      expect(phase()).toBe("idle");
      store.startRun();
      store.pauseRun();
      store.startRun();
      expect(phase()).toBe("paused");
    });

    it("最初から: paused/finished → running。runTokenが進み、メトリクス・履歴・resultが初期化される", () => {
      const store = useSimulationStore.getState();
      store.startRun();
      store.setMetrics({ ...useSimulationStore.getState().metrics, speed: 5, bottomOutCount: 3 });
      store.finishRun(result);
      const before = useSimulationStore.getState().runToken;

      useSimulationStore.getState().restartRun();
      const after = useSimulationStore.getState();
      expect(after.phase).toBe("running");
      expect(after.runToken).toBe(before + 1);
      expect(after.result).toBeNull();
      expect(after.metricsHistory).toHaveLength(0);
      expect(after.metrics.bottomOutCount).toBe(0);
    });

    it("running中にsetVehicleを呼ぶとidleに戻り、履歴・結果が空になりrunTokenが進む", () => {
      const store = useSimulationStore.getState();
      store.startRun();
      store.setMetrics({ ...useSimulationStore.getState().metrics, speed: 5 });
      const before = useSimulationStore.getState().runToken;

      useSimulationStore.getState().setVehicle({ body: { ...useSimulationStore.getState().vehicle.body, weightKg: 2000 } });
      const after = useSimulationStore.getState();
      expect(after.phase).toBe("idle");
      expect(after.metricsHistory).toHaveLength(0);
      expect(after.result).toBeNull();
      expect(after.runToken).toBe(before + 1);
    });

    it("一時停止中・終了後にsetTestConditionsを呼んでもidleに戻る", () => {
      const store = useSimulationStore.getState();
      store.startRun();
      store.pauseRun();
      useSimulationStore.getState().setTestConditions({ speed: 20 });
      expect(phase()).toBe("idle");

      useSimulationStore.getState().startRun();
      useSimulationStore.getState().finishRun(result);
      useSimulationStore.getState().setTestConditions({ terrainType: "washboard" });
      expect(phase()).toBe("idle");
      expect(useSimulationStore.getState().result).toBeNull();
    });

    it("resetでidleと初期状態に戻る", () => {
      useSimulationStore.getState().startRun();
      useSimulationStore.getState().finishRun(result);
      useSimulationStore.getState().reset();
      expect(phase()).toBe("idle");
      expect(useSimulationStore.getState().result).toBeNull();
    });
  });
});
