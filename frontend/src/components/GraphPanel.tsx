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

export function GraphPanel() {
  const metricsHistory = useSimulationStore((state) => state.metricsHistory);
  const bottomOutCount = useSimulationStore((state) => state.metrics.bottomOutCount);
  const strokeLength = useSimulationStore((state) => state.vehicle.suspension.strokeLength);
  const data = metricsHistory.map((metrics, index) => ({ tick: index, ...metrics }));

  return (
    // flexコンテナ（Home.tsx）内でwidth指定の無いブロック要素はデフォルトのmin-content幅に
    // 縮もうとし、ResponsiveContainer（recharts）がそれに合わせて極端に狭くなり、凡例・軸ラベルが
    // 重なって判読不能になる（issue #140）。flex-basisで最低限の描画幅を確保する。
    <div style={{ flex: "1 1 480px", minWidth: 320 }}>
      <h2>メトリクス</h2>
      <p>底付き回数: {bottomOutCount}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tick" label={{ value: "経過tick", position: "insideBottom", offset: -5 }} />
          <YAxis label={{ value: "G / m", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Legend />
          <ReferenceLine
            y={strokeLength}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{ value: "底付きライン(m)", position: "insideTopRight", fill: "#dc2626" }}
          />
          <Line type="monotone" dataKey="verticalG" name="上下G" stroke="#38bdf8" dot={false} />
          <Line
            type="monotone"
            dataKey="suspensionStroke"
            name="フロントストローク(m)"
            stroke="#f97316"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="rearSuspensionStroke"
            name="リアストローク(m)"
            stroke="#a855f7"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
