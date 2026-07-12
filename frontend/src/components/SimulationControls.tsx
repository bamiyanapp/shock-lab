import { useSimulationStore } from "../store/simulationStore";

export function SimulationControls() {
  const isRunning = useSimulationStore((state) => state.isRunning);
  const setRunning = useSimulationStore((state) => state.setRunning);

  return (
    <button type="button" onClick={() => setRunning(!isRunning)}>
      {isRunning ? "一時停止" : "開始"}
    </button>
  );
}
