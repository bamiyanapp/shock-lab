import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloseFullscreenButton, FullscreenHud } from "./VehicleCanvasFullscreen";
import { useSimulationStore } from "../store/simulationStore";

describe("CloseFullscreenButton", () => {
  it("押すとonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    render(<CloseFullscreenButton onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "フルスクリーンを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("FullscreenHud（issue #443）", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("速度(km/h)・上下G・底付き回数をストアのメトリクスから表示する", () => {
    useSimulationStore.getState().setMetrics({
      speed: 10,
      suspensionStroke: 0,
      rearSuspensionStroke: 0,
      verticalG: 0.5,
      maxImpact: 1,
      isBottomedOut: false,
      bottomOutCount: 3,
    });
    render(<FullscreenHud onPause={() => {}} />);
    expect(screen.getByText("速度: 36 km/h")).toBeInTheDocument();
    expect(screen.getByText("上下G: 0.50 G")).toBeInTheDocument();
    expect(screen.getByText("底付き: 3 回")).toBeInTheDocument();
  });

  it("ミュートと一時停止(✕)の操作ボタンがあり、タップ領域は44px四方以上", async () => {
    const onPause = vi.fn();
    render(<FullscreenHud onPause={onPause} />);

    const mute = screen.getByRole("button", { name: "ミュート" });
    const pause = screen.getByRole("button", { name: "フルスクリーンを閉じる" });
    expect(mute).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
    expect(pause).toHaveStyle({ minWidth: "44px", minHeight: "44px" });

    await userEvent.click(mute);
    expect(useSimulationStore.getState().isMuted).toBe(true);
    await userEvent.click(pause);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("HUDはcanvasより前面に置く（縦持ちで回転したcanvasにタップを奪われないため）", () => {
    render(<FullscreenHud onPause={() => {}} />);
    const hudRight = screen.getByRole("button", { name: "ミュート" }).parentElement;
    expect(hudRight).toHaveStyle({ zIndex: "1" });
  });
});
