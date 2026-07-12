import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSimulationStore } from "../store/simulationStore";

export function GraphPanel() {
  const metricsHistory = useSimulationStore((state) => state.metricsHistory);
  const data = metricsHistory.map((metrics, index) => ({ tick: index, ...metrics }));

  return (
    <div>
      <h2>メトリクス</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tick" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="verticalG" stroke="#38bdf8" dot={false} />
          <Line type="monotone" dataKey="suspensionStroke" stroke="#f97316" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
