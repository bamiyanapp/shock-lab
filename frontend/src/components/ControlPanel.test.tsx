import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "./ControlPanel";
import { useSimulationStore } from "../store/simulationStore";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { decodeSharedConfig, SHARED_CONFIG_QUERY_PARAM } from "../store/urlConfig";

describe("ControlPanel", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("applies the selected preset's vehicle config to the store", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const truckPreset = VEHICLE_PRESETS.find((preset) => preset.id === "truck");
    if (!truckPreset) throw new Error("truck preset not found");

    await user.selectOptions(screen.getByLabelText("プリセット"), truckPreset.id);

    expect(useSimulationStore.getState().vehicle).toEqual(truckPreset.config);
  });

  it("updates the vehicle when a value is typed directly into the numeric input next to a slider", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const weightInput = screen.getByRole("spinbutton", { name: /車重/ });
    await user.clear(weightInput);
    await user.type(weightInput, "2500");

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(2500);
  });

  it("displays the natural frequency and damping ratio computed from the current vehicle", () => {
    render(<ControlPanel />);
    const { weightKg } = useSimulationStore.getState().vehicle.body;
    const { springConstant, damperCoefficient } = useSimulationStore.getState().vehicle.suspension;
    const expectedFrequencyHz = ((1 / (2 * Math.PI)) * Math.sqrt(springConstant / weightKg)).toFixed(2);
    const expectedDampingRatio = (damperCoefficient / (2 * Math.sqrt(springConstant * weightKg))).toFixed(2);

    expect(
      screen.getByText(`固有振動数: ${expectedFrequencyHz} Hz / 減衰比 ζ: ${expectedDampingRatio}`)
    ).toBeInTheDocument();
  });

  it("copies a share URL encoding the current vehicle and testConditions to the clipboard", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    await user.click(screen.getByRole("button", { name: "セッティングを共有（URLをコピー）" }));

    expect(await screen.findByRole("status")).toHaveTextContent("リンクをコピーしました");
    const copiedText = await navigator.clipboard.readText();
    const copiedUrl = new URL(copiedText);
    const encoded = copiedUrl.searchParams.get(SHARED_CONFIG_QUERY_PARAM);
    const { vehicle, testConditions } = useSimulationStore.getState();
    expect(decodeSharedConfig(encoded as string)).toEqual({ vehicle, testConditions });
  });
});
