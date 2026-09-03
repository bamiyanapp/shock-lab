import { useSimulationStore } from "../store/simulationStore";
import type { ResultRank } from "../physics/resultRank";

const RANK_BADGE_CLASSES: Record<ResultRank, string> = {
  S: "text-bg-warning",
  A: "text-bg-info",
  B: "text-bg-success",
  C: "text-bg-secondary",
};

export function ResultScreen() {
  const result = useSimulationStore((state) => state.result);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (!result) return null;

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="card-title d-flex align-items-baseline gap-2">
          リザルト
          <span className={`badge fs-4 ${RANK_BADGE_CLASSES[result.rank]}`}>{result.rank}</span>
        </h2>
        <ul className="list-unstyled mb-3">
          <li>最大衝撃: {result.maxImpact.toFixed(2)} G</li>
          <li>底付き回数: {result.bottomOutCount} 回</li>
          <li>平均G（乗り心地）: {result.averageAbsVerticalG.toFixed(2)} G</li>
          <li>走破タイム: {result.elapsedSeconds.toFixed(1)} 秒</li>
        </ul>
        <button type="button" className="btn btn-primary" onClick={restartRun}>
          もう一度
        </button>
      </div>
    </div>
  );
}
