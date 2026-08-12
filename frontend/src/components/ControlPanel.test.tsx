import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "./ControlPanel";
import { useSimulationStore } from "../store/simulationStore";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";

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

  it("opens a QR share modal with the current settings' URL and copies it to the clipboard", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);
    const { vehicle, testConditions } = useSimulationStore.getState();
    const expectedUrl = buildShareUrl(vehicle, testConditions);

    await user.click(screen.getByRole("button", { name: "セッティングを共有" }));
    expect(await screen.findByText(expectedUrl)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "URLをコピー" }));
    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(expectedUrl);
  });
});
