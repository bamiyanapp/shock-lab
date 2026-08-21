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

  it("clears result when restarting or resetting the run", () => {
    useSimulationStore.getState().setResult({
      rank: "A",
      maxImpact: 2.5,
      bottomOutCount: 0,
      averageAbsVerticalG: 0.4,
      elapsedSeconds: 12.3,
    });
    expect(useSimulationStore.getState().result).not.toBeNull();

    useSimulationStore.getState().restartRun();
    expect(useSimulationStore.getState().result).toBeNull();

    useSimulationStore.getState().setResult({
      rank: "S",
      maxImpact: 1.0,
      bottomOutCount: 0,
      averageAbsVerticalG: 0.1,
      elapsedSeconds: 10,
    });
    useSimulationStore.getState().reset();
    expect(useSimulationStore.getState().result).toBeNull();
  });
});
