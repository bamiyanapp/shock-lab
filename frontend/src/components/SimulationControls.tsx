import { useSimulationStore } from "../store/simulationStore";
import { clickSound, unlockNonInteractiveSoundEffects } from "../audio/soundEffects";
import { computeStaticState } from "../physics/vehicleGeometry";
import { MuteToggle } from "./MuteToggle";

// ボタン押下は必ずユーザー操作イベント内で発生するため、この関数呼び出しを
// iOS Safari等の自動再生ポリシーに対するアンロックの契機としても利用する。
function playClickSound() {
  clickSound.play();
  unlockNonInteractiveSoundEffects();
}

export function SimulationControls() {
  const phase = useSimulationStore((state) => state.phase);
  const startRun = useSimulationStore((state) => state.startRun);
  const pauseRun = useSimulationStore((state) => state.pauseRun);
  const resumeRun = useSimulationStore((state) => state.resumeRun);
  const restartRun = useSimulationStore((state) => state.restartRun);
  // 初めから底付きになる設定は走れないため、開始できない（issue #557）。
  const cannotRun = useSimulationStore((state) => computeStaticState(state.vehicle).isBottomedOutAtStart);

  const withClick = (action: () => void) => () => {
    playClickSound();
    action();
  };

  return (
    <div className="d-flex gap-2">
      {phase === "running" && (
        <button type="button" className="btn btn-secondary" onClick={withClick(pauseRun)}>
          一時停止
        </button>
      )}
      {phase === "idle" && (
        <button type="button" className="btn btn-primary" onClick={withClick(startRun)} disabled={cannotRun}>
          開始
        </button>
      )}
      {phase === "paused" && (
        <button type="button" className="btn btn-primary" onClick={withClick(resumeRun)}>
          再開
        </button>
      )}
      {(phase === "paused" || phase === "finished") && (
        <button type="button" className="btn btn-outline-secondary" onClick={withClick(restartRun)} disabled={cannotRun}>
          最初から
        </button>
      )}
      <MuteToggle />
    </div>
  );
}
