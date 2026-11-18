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

  it("updates the vehicle when a value is typed into the numeric input and confirmed (blur/Enter)", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const weightInput = screen.getByRole("spinbutton", { name: /車重/ });
    await user.clear(weightInput);
    await user.type(weightInput, "2500");
    // 入力中は確定しない（途中の値でシミュレーションを作り直さない）
    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(1200);

    await user.keyboard("{Enter}");
    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(2500);
  });

  it("restores the original value when the numeric input is emptied and blurred (issue #446)", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const weightInput = screen.getByRole("spinbutton", { name: /車重/ });
    await user.clear(weightInput);
    await user.tab();

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(1200);
    expect(weightInput).toHaveValue(1200);
  });

  it("clamps out-of-range numeric input to the allowed range (issue #446)", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const weightInput = screen.getByRole("spinbutton", { name: /車重/ });
    await user.clear(weightInput);
    await user.type(weightInput, "999999");
    await user.tab();

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(30000);
  });

  it("shows the matching preset, and 'カスタム' after a slider changes the vehicle (issue #446)", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const presetSelect = screen.getByLabelText("プリセット");
    expect(presetSelect).toHaveValue("sedan");

    await user.selectOptions(presetSelect, "truck");
    expect(presetSelect).toHaveValue("truck");

    const weightInput = screen.getByRole("spinbutton", { name: /車重/ });
    await user.clear(weightInput);
    await user.type(weightInput, "1234");
    await user.tab();
    expect(presetSelect).toHaveValue("custom");
  });

  it("displays the natural frequency and damping ratio computed from the current vehicle", () => {
    render(<ControlPanel />);
    // ばね上質量 = 車重 - 160kg、4輪ぶんのバネ・ダンパーで支える（docs/physics-model.md）。
    const { weightKg } = useSimulationStore.getState().vehicle.body;
    const { springConstant, damperCoefficient } = useSimulationStore.getState().vehicle.suspension;
    const sprungMassKg = weightKg - 160;
    const expectedFrequencyHz = ((1 / (2 * Math.PI)) * Math.sqrt((4 * springConstant) / sprungMassKg)).toFixed(2);
    const expectedDampingRatio = ((4 * damperCoefficient) / (2 * Math.sqrt(4 * springConstant * sprungMassKg))).toFixed(2);

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

  it("減衰比ζの補足文をtitle属性ではなく本文として常時表示する（issue #449）", () => {
    render(<ControlPanel />);
    expect(screen.getByText(/ζが1未満: 揺れが残りやすい（ふわふわ）／1超: 動きが硬い（ガチガチ）/)).toBeInTheDocument();
  });
});
