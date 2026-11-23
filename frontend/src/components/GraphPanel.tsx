import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useSimulationStore } from "../store/simulationStore";
import { shouldShowMetrics } from "./metricsVisibility";

const CHART_HEIGHT = 200;

// 横軸は走行距離(m)。バンプの位置と対応づけて読めるようにする（issue #447）。
const DISTANCE_AXIS = { dataKey: "distanceM", type: "number", domain: [0, "dataMax"] } as const;

export function GraphPanel() {
  const metricsHistory = useSimulationStore((state) => state.metricsHistory);
  const bottomOutCount = useSimulationStore((state) => state.metrics.bottomOutCount);
  const strokeLength = useSimulationStore((state) => state.vehicle.suspension.strokeLength);
  const isVisible = useSimulationStore((state) => shouldShowMetrics(state.phase));

  // 走行前・走行中は表示しない（領域も取らない）。
  if (!isVisible) return null;

  return (
    // flexコンテナ（Home.tsx）内でwidth指定の無いブロック要素はデフォルトのmin-content幅に
    // 縮もうとし、ResponsiveContainer（recharts）がそれに合わせて極端に狭くなり、凡例・軸ラベルが
    // 重なって判読不能になる（issue #140）。flex-basisで最低限の描画幅を確保する。
    <div style={{ flex: "1 1 480px", minWidth: 320 }}>
      <h2>メトリクス</h2>
      <p>底付き回数: {bottomOutCount}</p>
      <div className="d-flex flex-column gap-3" data-testid="metrics-graphs">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={metricsHistory} syncId="metrics">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis {...DISTANCE_AXIS} label={{ value: "走行距離(m)", position: "insideBottom", offset: -5 }} />
            <YAxis label={{ value: "G", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="verticalG"
              name="上下G"
              stroke="#38bdf8"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={metricsHistory} syncId="metrics">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis {...DISTANCE_AXIS} label={{ value: "走行距離(m)", position: "insideBottom", offset: -5 }} />
            <YAxis label={{ value: "m", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <ReferenceLine
              y={strokeLength}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{ value: "底付きライン(m)", position: "insideTopRight", fill: "#dc2626" }}
            />
            <Line
              type="monotone"
              dataKey="frontStroke"
              name="フロントストローク(m)"
              stroke="#f97316"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="rearStroke"
              name="リアストローク(m)"
              stroke="#a855f7"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
