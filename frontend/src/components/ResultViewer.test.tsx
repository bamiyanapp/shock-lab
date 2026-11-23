import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultViewer } from "./ResultViewer";
import { useSimulationStore } from "../store/simulationStore";

import type { SimulationResult } from "../store/simulationStore";

const goalResult: SimulationResult = {
  outcome: "goal",
  rank: "A",
  maxImpact: 2.5,
  bottomOutCount: 1,
  averageAbsVerticalG: 0.42,
  elapsedSeconds: 12.3,
  distanceMeters: 190,
};

describe("ResultViewer（issue #576）", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("走行前は、ボタンもビューも出さない", () => {
    render(<ResultViewer />);
    expect(screen.queryByRole("button", { name: "リザルト" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("一時停止中は、ボタンだけを出す。押すと、メトリクスを含むビューが開く", async () => {
    const user = userEvent.setup();
    render(<ResultViewer />);
    act(() => {
      useSimulationStore.getState().startRun();
      useSimulationStore.getState().pauseRun();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "リザルト" }));

    expect(screen.getByRole("dialog", { name: "リザルト" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "メトリクス" })).toBeInTheDocument();
  });

  it("ゴールで終了すると、ビューが自動で開き、リザルトとメトリクスが入っている。閉じられる", async () => {
    const user = userEvent.setup();
    render(<ResultViewer />);
    act(() => {
      useSimulationStore.getState().startRun();
      useSimulationStore.getState().finishRun(goalResult);
    });

    const dialog = screen.getByRole("dialog", { name: "リザルト" });
    expect(dialog).toHaveTextContent("最大衝撃: 2.50 G");
    expect(dialog).toHaveTextContent("メトリクス");

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リザルト" })).toBeInTheDocument();
  });

  it("「もう一度」で走り直すと、ビューもボタンも消える", async () => {
    const user = userEvent.setup();
    render(<ResultViewer />);
    act(() => {
      useSimulationStore.getState().startRun();
      useSimulationStore.getState().finishRun(goalResult);
    });

    await user.click(screen.getByRole("button", { name: "もう一度" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "リザルト" })).not.toBeInTheDocument();
  });
});
