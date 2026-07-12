import { VehicleCanvas } from "../components/VehicleCanvas";
import { ControlPanel } from "../components/ControlPanel";
import { GraphPanel } from "../components/GraphPanel";

export function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <h1>ShockLab</h1>
      <VehicleCanvas />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <ControlPanel />
        <GraphPanel />
      </div>
    </div>
  );
}
