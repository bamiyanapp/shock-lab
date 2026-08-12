import { useEffect } from "react";
import { VehicleCanvas } from "../components/VehicleCanvas";
import { ControlPanel } from "../components/ControlPanel";
import { GraphPanel } from "../components/GraphPanel";
import { SimulationControls } from "../components/SimulationControls";
import { useSimulationStore } from "../store/simulationStore";
import { decodeSharedConfig, SHARED_CONFIG_QUERY_PARAM } from "../store/urlConfig";

export function Home() {
  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get(SHARED_CONFIG_QUERY_PARAM);
    if (!encoded) return;

    const shared = decodeSharedConfig(encoded);
    if (!shared) return;

    useSimulationStore.getState().setVehicle(shared.vehicle);
    useSimulationStore.getState().setTestConditions(shared.testConditions);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <h1>ShockLab</h1>
      <VehicleCanvas />
      <SimulationControls />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <ControlPanel />
        <GraphPanel />
      </div>
    </div>
  );
}
