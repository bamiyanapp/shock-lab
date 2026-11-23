import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlPanel } from "./ControlPanel";
import { SuspensionPanel } from "./SuspensionPanel";
import { useSimulationStore } from "../store/simulationStore";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";

// 車両パラメータとサスペンション設定は別のタブだが、車両の設定（ストア）は共通のため、両方を描いて検証する。
function Panels() {
  return (
    <>
      <ControlPanel />
      <SuspensionPanel />
    </>
  );
}

describe("ControlPanel", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("applies the selected preset's vehicle config to the store", async () => {
    const user = userEvent.setup();
    render(<Panels />);

    const truckPreset = VEHICLE_PRESETS.find((preset) => preset.id === "truck");
    if (!truckPreset) throw new Error("truck preset not found");

    await user.selectOptions(screen.getByLabelText("プリセット"), truckPreset.id);

    expect(useSimulationStore.getState().vehicle).toEqual(truckPreset.config);
  });

  it("updates the vehicle when the slider is moved, and shows the value with its unit (issue #536)", () => {
    render(<Panels />);

    const weightSlider = screen.getByRole("slider", { name: /車重/ });
    expect(weightSlider).toHaveAttribute("aria-valuetext", "1200 kg");
    fireEvent.change(weightSlider, { target: { value: "2500" } });

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(2500);
    expect(weightSlider).toHaveAttribute("aria-valuetext", "2500 kg");
  });

  it("has no numeric input: values are shown, and only the slider changes them (issue #536)", () => {
    render(<Panels />);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("keeps the slider inside the allowed range (issue #446)", () => {
    render(<Panels />);

    const weightSlider = screen.getByRole("slider", { name: /車重/ });
    fireEvent.change(weightSlider, { target: { value: "999999" } });

    expect(useSimulationStore.getState().vehicle.body.weightKg).toBe(30000);
  });

  it("shows the matching preset, and 'カスタム' after a slider changes the vehicle (issue #446)", async () => {
    const user = userEvent.setup();
    render(<Panels />);

    const presetSelect = screen.getByLabelText("プリセット");
    expect(presetSelect).toHaveValue("sedan");

    await user.selectOptions(presetSelect, "truck");
    expect(presetSelect).toHaveValue("truck");

    fireEvent.change(screen.getByRole("slider", { name: /車重/ }), { target: { value: "1250" } });
    expect(presetSelect).toHaveValue("custom");
  });

  it("displays the natural frequency and damping ratio computed from the current vehicle", () => {
    render(<Panels />);
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
    render(<Panels />);
    const { vehicle, testConditions } = useSimulationStore.getState();
    const expectedUrl = buildShareUrl(vehicle, testConditions);

    await user.click(screen.getByRole("button", { name: "セッティングを共有" }));
    expect(await screen.findByText(expectedUrl)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "URLをコピー" }));
    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(expectedUrl);
  });

  it("減衰比ζの補足文をtitle属性ではなく本文として常時表示する（issue #449）", () => {
    render(<Panels />);
    expect(screen.getByText(/ζが1未満: 揺れが残りやすい（ふわふわ）／1超: 動きが硬い（ガチガチ）/)).toBeInTheDocument();
  });

  it("ストローク量のスライダーで車両のstrokeLengthを変えられる（issue #445）", () => {
    render(<Panels />);

    // 表示はcm、内部はm
    const strokeSlider = screen.getByRole("slider", { name: /ストローク量/ });
    fireEvent.change(strokeSlider, { target: { value: "0.3" } });

    expect(useSimulationStore.getState().vehicle.suspension.strokeLength).toBeCloseTo(0.3, 10);
    expect(strokeSlider).toHaveAttribute("aria-valuetext", "30 cm");
  });

  it("バネ定数はkN/m、ダンパー減衰はkN・s/m、バネ取り付け位置はcmで表示し、内部の単位で保持する（issue #510・#518）", () => {
    render(<Panels />);

    const springSlider = screen.getByRole("slider", { name: /バネ定数/ });
    expect(springSlider).toHaveAttribute("aria-valuetext", "30 kN/m");
    fireEvent.change(springSlider, { target: { value: "50000" } });
    expect(useSimulationStore.getState().vehicle.suspension.springConstant).toBe(50000);
    expect(springSlider).toHaveAttribute("aria-valuetext", "50 kN/m");

    const damperSlider = screen.getByRole("slider", { name: /ダンパー減衰/ });
    fireEvent.change(damperSlider, { target: { value: "2500" } });
    expect(useSimulationStore.getState().vehicle.suspension.damperCoefficient).toBe(2500);
    expect(damperSlider).toHaveAttribute("aria-valuetext", "2.5 kN・s/m");

    const mountHeightSlider = screen.getByRole("slider", { name: /バネ取り付け位置/ });
    fireEvent.change(mountHeightSlider, { target: { value: "0.35" } });
    expect(useSimulationStore.getState().vehicle.suspension.mountHeight).toBeCloseTo(0.35, 10);
    expect(mountHeightSlider).toHaveAttribute("aria-valuetext", "35 cm");
  });

  it("駆動方式を、ラジオボタンで選べて、車両の設定へ反映される（issue #535・#552）", async () => {
    const user = userEvent.setup();
    render(<Panels />);

    expect(screen.getByRole("group", { name: "駆動方式" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /（4WD）|（FF）|（FR）/ })).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "四駆（4WD）" })).toBeChecked();

    await user.click(screen.getByText("前輪駆動（FF）"));
    expect(useSimulationStore.getState().vehicle.body.driveType).toBe("ff");
    expect(screen.getByRole("radio", { name: "前輪駆動（FF）" })).toBeChecked();
    await user.click(screen.getByText("後輪駆動（FR）"));
    expect(useSimulationStore.getState().vehicle.body.driveType).toBe("fr");
    expect(screen.getByRole("radio", { name: "四駆（4WD）" })).not.toBeChecked();
    // プリセットと一致しなくなるため、カスタム表示になる
    expect(screen.getByLabelText("プリセット")).toHaveValue("custom");
  });

  it("ホイールベースをスライダーで変えられ、mで表示する（issue #541）", () => {
    render(<Panels />);

    const slider = screen.getByRole("slider", { name: /ホイールベース/ });
    expect(slider).toHaveAttribute("aria-valuetext", "2.5 m");
    fireEvent.change(slider, { target: { value: "3.4" } });

    expect(useSimulationStore.getState().vehicle.body.wheelbase).toBeCloseTo(3.4, 10);
    expect(slider).toHaveAttribute("aria-valuetext", "3.4 m");
    expect(screen.getByLabelText("プリセット")).toHaveValue("custom");
  });

  it("実際の車高と静止時のたわみを、読み取り専用で表示する。取り付け位置を上げると車高が上がる（issue #557）", () => {
    render(<Panels />);
    const readout = screen.getByTestId("static-state");
    expect(readout).toHaveTextContent(/実際の車高: \d+\.\d cm/);
    expect(readout).toHaveTextContent(/静止時のたわみ: 前\d+\.\d cm/);
    const before = Number(/実際の車高: ([\d.]+) cm/.exec(readout.textContent ?? "")?.[1]);

    fireEvent.change(screen.getByRole("slider", { name: /バネ取り付け位置/ }), { target: { value: "0.4" } });

    const after = Number(/実際の車高: ([\d.]+) cm/.exec(screen.getByTestId("static-state").textContent ?? "")?.[1]);
    expect(after).toBeGreaterThan(before);
  });

  it("低いバネ定数・重い車重で、初めから底付きになる場合は、警告を表示する（issue #557）", () => {
    render(<Panels />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: /バネ定数/ }), { target: { value: "5000" } });
    fireEvent.change(screen.getByRole("slider", { name: /車重/ }), { target: { value: "5000" } });

    expect(screen.getByRole("alert")).toHaveTextContent("走れません");
  });

  it("車両パラメータとサスペンション設定は、別のパネルに分かれている（issue #572）", () => {
    const { unmount } = render(<ControlPanel />);
    expect(screen.getByRole("slider", { name: /車重/ })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /ホイールベース/ })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /バネ定数/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("static-state")).not.toBeInTheDocument();
    unmount();

    render(<SuspensionPanel />);
    for (const name of [/バネ定数/, /ダンパー減衰/, /ストローク量/, /バネ取り付け位置/]) {
      expect(screen.getByRole("slider", { name })).toBeInTheDocument();
    }
    expect(screen.getByTestId("static-state")).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /車重/ })).not.toBeInTheDocument();
  });
});
