import { useSimulationStore } from "../store/simulationStore";
import type { ResultRank } from "../physics/resultRank";
import type { RetireReason } from "../store/simulationStore";

const RANK_BADGE_CLASSES: Record<ResultRank, string> = {
  S: "text-bg-warning",
  A: "text-bg-info",
  B: "text-bg-success",
  C: "text-bg-secondary",
};

const RETIRE_LABELS: Record<RetireReason, string> = {
  overturned: "転倒",
  stuck: "走行不能",
  fellOff: "コースアウト",
  timeout: "時間切れ",
};

export function ResultScreen() {
  const result = useSimulationStore((state) => state.result);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (!result) return null;

  return (
    <div className="card">
      <div className="card-body">
        {result.outcome === "retire" ? (
          <h2 className="card-title">リタイア（{RETIRE_LABELS[result.retireReason ?? "stuck"]}）</h2>
        ) : (
          <h2 className="card-title d-flex align-items-baseline gap-2">
            リザルト
            {result.rank && <span className={`badge fs-4 ${RANK_BADGE_CLASSES[result.rank]}`}>{result.rank}</span>}
          </h2>
        )}
        <ul className="list-unstyled mb-3">
          <li>最大衝撃: {result.maxImpact.toFixed(2)} G</li>
          <li>底付き回数: {result.bottomOutCount} 回</li>
          {result.outcome === "retire" ? (
            <li>到達距離: {result.distanceMeters.toFixed(0)} m</li>
          ) : (
            <>
              <li>平均G（乗り心地）: {result.averageAbsVerticalG.toFixed(2)} G</li>
              <li>走破タイム: {result.elapsedSeconds.toFixed(1)} 秒</li>
            </>
          )}
        </ul>
        <button type="button" className="btn btn-primary" onClick={restartRun}>
          もう一度
        </button>
      </div>
    </div>
  );
}
