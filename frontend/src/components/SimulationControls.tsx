import { useSimulationStore } from "../store/simulationStore";
import { clickSound, unlockNonInteractiveSoundEffects } from "../audio/soundEffects";
import { applyEngineSoundMuted } from "../audio/engineSound";

// ボタン押下は必ずユーザー操作イベント内で発生するため、この関数呼び出しを
// iOS Safari等の自動再生ポリシーに対するアンロックの契機としても利用する。
function playClickSound() {
  clickSound.play();
  unlockNonInteractiveSoundEffects();
}

// クリック音・衝撃音・エンジン音等すべてのサウンドフィードバックのミュートトグル（issue #53）。
function MuteToggle() {
  const isMuted = useSimulationStore((state) => state.isMuted);
  const setMuted = useSimulationStore((state) => state.setMuted);

  return (
    <button
      type="button"
      className="btn btn-outline-secondary"
      aria-label={isMuted ? "ミュート解除" : "ミュート"}
      onClick={() => {
        setMuted(!isMuted);
        applyEngineSoundMuted();
      }}
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  );
}

export function SimulationControls() {
  const isRunning = useSimulationStore((state) => state.isRunning);
  const hasStarted = useSimulationStore((state) => state.hasStarted);
  const setRunning = useSimulationStore((state) => state.setRunning);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (isRunning) {
    return (
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            playClickSound();
            setRunning(false);
          }}
        >
          一時停止
        </button>
        <MuteToggle />
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            playClickSound();
            setRunning(true);
          }}
        >
          開始
        </button>
        <MuteToggle />
      </div>
    );
  }

  return (
    <div className="d-flex gap-2">
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          playClickSound();
          setRunning(true);
        }}
      >
        再開
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => {
          playClickSound();
          restartRun();
        }}
      >
        最初から
      </button>
      <MuteToggle />
    </div>
  );
}
