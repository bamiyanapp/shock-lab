import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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
    const testConditions = { speed: 15, terrainType: "jumpRamp" as const };
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

  it("プレビュー（キャンバス・タブ見出し）を固定領域に置き、設定のパネルは、その外に置く（issue #550）", () => {
    render(<Home />);
    const preview = screen.getByTestId("preview-area");
    expect(preview).toHaveClass("sticky-top");
    expect(preview).toContainElement(screen.getByTestId("vehicle-canvas-stub"));
    expect(preview).toContainElement(screen.getByRole("tablist"));
    expect(preview).not.toContainElement(screen.getByTestId("settings-scroller"));
  });

  it("操作ボタン（開始など）は、固定領域の外の上部にある（issue #583）", () => {
    render(<Home />);
    const preview = screen.getByTestId("preview-area");
    const controls = screen.getByTestId("controls-area");
    expect(controls).toContainElement(screen.getByRole("button", { name: "開始" }));
    expect(preview).not.toContainElement(controls);
    // 画面の並びで、固定領域より前にある
    expect(controls.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("パネルの中に、見出し（試験条件など）を置かない。タブ見出しが、その役割を持つ（issue #583）", () => {
    render(<Home />);
    expect(screen.queryByRole("heading", { name: "試験条件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "車両パラメータ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "サスペンション設定" })).not.toBeInTheDocument();
  });

  it("試験条件と車両パラメータが、タブで切り替えられる設定のパネルに入っている（issue #550）", () => {
    render(<Home />);
    expect(screen.getByRole("tab", { name: "試験条件" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "車両" })).toBeInTheDocument();
    const scroller = screen.getByTestId("settings-scroller");
    expect(scroller).toContainElement(screen.getByRole("group", { name: "路面" }));
    expect(scroller).toContainElement(screen.getByRole("group", { name: "駆動方式" }));
  });

  it("リザルトとメトリクスは、設定の画面に出さない（issue #576）", () => {
    render(<Home />);
    act(() => {
      useSimulationStore.getState().startRun();
      useSimulationStore.getState().finishRun({
        outcome: "goal",
        rank: "A",
        maxImpact: 1,
        bottomOutCount: 0,
        averageAbsVerticalG: 0.1,
        elapsedSeconds: 10,
        distanceMeters: 100,
      });
    });

    const scroller = screen.getByTestId("settings-scroller");
    expect(scroller).not.toHaveTextContent("最大衝撃");
    // ビュー（ダイアログ）の中にだけ、リザルトがある。
    expect(screen.getByRole("dialog", { name: "リザルト" })).toHaveTextContent("最大衝撃");
  });

  it("3つのタブ見出しが、短い名前で並ぶ（issue #576）", () => {
    render(<Home />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["試験条件", "車両", "サスペンション"]);
  });
});
