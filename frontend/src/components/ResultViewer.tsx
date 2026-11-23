import { useState } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { GraphPanel } from "./GraphPanel";
import { ResultScreen } from "./ResultScreen";
import { shouldShowMetrics } from "./metricsVisibility";

/**
 * リザルトとメトリクスをまとめたビュー（ダイアログ）と、それを開くボタン（issue #576）。
 * 設定の画面には出さず、「開始」「音声」ボタンの隣のボタンで開く。
 * 一時停止中と終了後にだけ使える。ゴール・リタイアで終了したときは、自動で開く。
 */
export function ResultViewer() {
  const phase = useSimulationStore((state) => state.phase);
  const available = shouldShowMetrics(phase);
  const [open, setOpen] = useState(false);

  // 状態が変わった描画の中で、開閉を決める（effectでのsetStateは、無駄な再描画を招くため使わない）。
  // 終了したら開き、走り直し・設定変更で使えなくなったら閉じる。
  const [previousPhase, setPreviousPhase] = useState(phase);
  if (previousPhase !== phase) {
    setPreviousPhase(phase);
    setOpen(phase === "finished");
  }

  if (!available) return null;

  return (
    <>
      <button type="button" className="btn btn-outline-primary" onClick={() => setOpen(true)}>
        リザルト
      </button>
      {open && (
        <>
          <div className="modal d-block show" tabIndex={-1} role="dialog" aria-modal="true" aria-label="リザルト">
            <div className="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5">リザルト</h2>
                  <button type="button" className="btn-close" aria-label="閉じる" onClick={() => setOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <ResultScreen />
                  {/* flexの横並びの中に置き、GraphPanelの幅の指定を保つ。 */}
                  <div className="d-flex">
                    <GraphPanel />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" onClick={() => setOpen(false)} />
        </>
      )}
    </>
  );
}
