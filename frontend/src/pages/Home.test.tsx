import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Home } from "./Home";
import { useSimulationStore } from "../store/simulationStore";
import { encodeSharedConfig } from "../store/urlConfig";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";

// jsdomはcanvasの2Dコンテキストを提供しないため、Matter.jsの描画を行う
// VehicleCanvasはモックしてUIレイアウトのみを検証する。
vi.mock("../components/VehicleCanvas", () => ({
  VehicleCanvas: () => <div data-testid="vehicle-canvas-stub" />,
}));

describe("Home", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("applies a shared config from the URL's config query param on mount", async () => {
    const truckPreset = VEHICLE_PRESETS.find((preset) => preset.id === "truck");
    if (!truckPreset) throw new Error("truck preset not found");
    const testConditions = { speed: 15, bumpHeight: 0.3, slopeAngle: 10, terrainType: "jumpRamp" as const };
    const encoded = encodeSharedConfig(truckPreset.config, testConditions);
    window.history.pushState({}, "", `/?config=${encoded}`);

    render(<Home />);

    await waitFor(() => {
      expect(useSimulationStore.getState().vehicle).toEqual(truckPreset.config);
    });
    expect(useSimulationStore.getState().testConditions).toEqual(testConditions);
  });

  it("keeps the default vehicle when there is no config query param", () => {
    render(<Home />);
    expect(useSimulationStore.getState().vehicle).toEqual(VEHICLE_PRESETS[0].config);
  });

  it("shows the build-time version at the top (frontend-ui-conventions.md required item)", () => {
    render(<Home />);
    expect(screen.getByText(new RegExp(`^v${__APP_VERSION__}`))).toBeInTheDocument();
  });
});
