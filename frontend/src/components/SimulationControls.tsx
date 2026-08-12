import { useSimulationStore } from "../store/simulationStore";

export function SimulationControls() {
  const isRunning = useSimulationStore((state) => state.isRunning);
  const hasStarted = useSimulationStore((state) => state.hasStarted);
  const setRunning = useSimulationStore((state) => state.setRunning);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (isRunning) {
    return (
      <button type="button" onClick={() => setRunning(false)}>
        一時停止
      </button>
    );
  }

  if (!hasStarted) {
    return (
      <button type="button" onClick={() => setRunning(true)}>
        開始
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" onClick={() => setRunning(true)}>
        再開
      </button>
      <button type="button" onClick={restartRun}>
        最初から
      </button>
    </div>
  );
}
