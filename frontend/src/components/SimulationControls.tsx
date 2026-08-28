import { useSimulationStore } from "../store/simulationStore";
import { clickSound, unlockNonInteractiveSoundEffects } from "../audio/soundEffects";

// ボタン押下は必ずユーザー操作イベント内で発生するため、この関数呼び出しを
// iOS Safari等の自動再生ポリシーに対するアンロックの契機としても利用する。
function playClickSound() {
  clickSound.play();
  unlockNonInteractiveSoundEffects();
}

export function SimulationControls() {
  const isRunning = useSimulationStore((state) => state.isRunning);
  const hasStarted = useSimulationStore((state) => state.hasStarted);
  const setRunning = useSimulationStore((state) => state.setRunning);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (isRunning) {
    return (
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setRunning(false);
        }}
      >
        一時停止
      </button>
    );
  }

  if (!hasStarted) {
    return (
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setRunning(true);
        }}
      >
        開始
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setRunning(true);
        }}
      >
        再開
      </button>
      <button
        type="button"
        onClick={() => {
          playClickSound();
          restartRun();
        }}
      >
        最初から
      </button>
    </div>
  );
}
