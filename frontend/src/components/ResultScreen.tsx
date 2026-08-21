import { useSimulationStore } from "../store/simulationStore";
import type { ResultRank } from "../physics/resultRank";

const RANK_COLORS: Record<ResultRank, string> = {
  S: "#facc15",
  A: "#38bdf8",
  B: "#4ade80",
  C: "#94a3b8",
};

export function ResultScreen() {
  const result = useSimulationStore((state) => state.result);
  const restartRun = useSimulationStore((state) => state.restartRun);

  if (!result) return null;

  return (
    <div
      style={{
        border: "2px solid #0f766e",
        borderRadius: 8,
        padding: 16,
        background: "#0f172a",
        color: "#f0fdfa",
      }}
    >
      <h2 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
        リザルト
        <span style={{ color: RANK_COLORS[result.rank], fontSize: 32, fontWeight: "bold" }}>
          {result.rank}
        </span>
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
        <li>最大衝撃: {result.maxImpact.toFixed(2)} G</li>
        <li>底付き回数: {result.bottomOutCount} 回</li>
        <li>平均G（乗り心地）: {result.averageAbsVerticalG.toFixed(2)} G</li>
        <li>走破タイム: {result.elapsedSeconds.toFixed(1)} 秒</li>
      </ul>
      <button type="button" onClick={restartRun}>
        もう一度
      </button>
    </div>
  );
}
