import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("updates the vehicle when the slider is moved, and shows the value with its unit (issue #536)", () => {
    render(<ControlPanel />);

    const weightSlider = screen.getByRole("slider", { name: /車重/ });
    expect(weightSlider).toHaveAttribute("aria-valuetext", "1200 kg");
    fireEvent.change(weightSlider, { target: { value: "2500" } });

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(2500);
    expect(weightSlider).toHaveAttribute("aria-valuetext", "2500 kg");
  });

  it("has no numeric input: values are shown, and only the slider changes them (issue #536)", () => {
    render(<ControlPanel />);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("keeps the slider inside the allowed range (issue #446)", () => {
    render(<ControlPanel />);

    const weightSlider = screen.getByRole("slider", { name: /車重/ });
    fireEvent.change(weightSlider, { target: { value: "999999" } });

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(30000);
  });

  it("shows the matching preset, and 'カスタム' after a slider changes the vehicle (issue #446)", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const presetSelect = screen.getByLabelText("プリセット");
    expect(presetSelect).toHaveValue("sedan");

    await user.selectOptions(presetSelect, "truck");
    expect(presetSelect).toHaveValue("truck");

    fireEvent.change(screen.getByRole("slider", { name: /車重/ }), { target: { value: "1250" } });
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

  it("ストローク量のスライダーで車両のstrokeLengthを変えられる（issue #445）", () => {
    render(<ControlPanel />);

    // 表示はcm、内部はm
    const strokeSlider = screen.getByRole("slider", { name: /ストローク量/ });
    fireEvent.change(strokeSlider, { target: { value: "0.3" } });

    expect(useSimulationStore.getState().vehicle.suspension.strokeLength).toBeCloseTo(0.3, 10);
    expect(strokeSlider).toHaveAttribute("aria-valuetext", "30 cm");
  });

  it("バネ定数はkN/m、ダンパー減衰はkN・s/m、車高はcmで表示し、内部の単位で保持する（issue #510・#518）", () => {
    render(<ControlPanel />);

    const springSlider = screen.getByRole("slider", { name: /バネ定数/ });
    expect(springSlider).toHaveAttribute("aria-valuetext", "30 kN/m");
    fireEvent.change(springSlider, { target: { value: "50000" } });
    expect(useSimulationStore.getState().vehicle.suspension.springConstant).toBe(50000);
    expect(springSlider).toHaveAttribute("aria-valuetext", "50 kN/m");

    const damperSlider = screen.getByRole("slider", { name: /ダンパー減衰/ });
    fireEvent.change(damperSlider, { target: { value: "2500" } });
    expect(useSimulationStore.getState().vehicle.suspension.damperCoefficient).toBe(2500);
    expect(damperSlider).toHaveAttribute("aria-valuetext", "2.5 kN・s/m");

    const rideHeightSlider = screen.getByRole("slider", { name: /車高/ });
    fireEvent.change(rideHeightSlider, { target: { value: "0.35" } });
    expect(useSimulationStore.getState().vehicle.suspension.rideHeight).toBeCloseTo(0.35, 10);
    expect(rideHeightSlider).toHaveAttribute("aria-valuetext", "35 cm");
  });

  it("駆動方式を選べて、車両の設定へ反映される（issue #535）", async () => {
    const user = userEvent.setup();
    render(<ControlPanel />);

    const select = screen.getByLabelText("駆動方式");
    expect(select).toHaveValue("awd");
    await user.selectOptions(select, "ff");
    expect(useSimulationStore.getState().vehicle.body.driveType).toBe("ff");
    await user.selectOptions(select, "fr");
    expect(useSimulationStore.getState().vehicle.body.driveType).toBe("fr");
    // プリセットと一致しなくなるため、カスタム表示になる
    expect(screen.getByLabelText("プリセット")).toHaveValue("custom");
  });
});
