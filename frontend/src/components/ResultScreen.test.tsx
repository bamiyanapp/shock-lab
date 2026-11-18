import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultScreen } from "./ResultScreen";
import { useSimulationStore } from "../store/simulationStore";

import type { SimulationResult } from "../store/simulationStore";

const goalResult = (overrides: Partial<SimulationResult> = {}): SimulationResult => ({
  outcome: "goal",
  rank: "A",
  maxImpact: 2.5,
  bottomOutCount: 1,
  averageAbsVerticalG: 0.42,
  elapsedSeconds: 12.3,
  distanceMeters: 190,
  ...overrides,
});

// 走行中の状態からゴール・リタイアで終了させる。
function finishWith(result: SimulationResult) {
  useSimulationStore.getState().startRun();
  useSimulationStore.getState().finishRun(result);
}

describe("ResultScreen", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("renders nothing when there is no result yet", () => {
    const { container } = render(<ResultScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the rank and stats once a result is set", () => {
    finishWith(goalResult());

    render(<ResultScreen />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("最大衝撃: 2.50 G")).toBeInTheDocument();
    expect(screen.getByText("底付き回数: 1 回")).toBeInTheDocument();
    expect(screen.getByText("平均G（乗り心地）: 0.42 G")).toBeInTheDocument();
    expect(screen.getByText("走破タイム: 12.3 秒")).toBeInTheDocument();
  });

  it("もう一度 restarts the run and clears the result", async () => {
    const user = userEvent.setup();
    finishWith(goalResult());
    render(<ResultScreen />);

    await user.click(screen.getByRole("button", { name: "もう一度" }));

    expect(useSimulationStore.getState().result).toBeNull();
    expect(useSimulationStore.getState().phase).toBe("running");
  });

  it.each([
    ["overturned", "リタイア（転倒）"],
    ["stuck", "リタイア（走行不能）"],
    ["fellOff", "リタイア（コースアウト）"],
    ["timeout", "リタイア（時間切れ）"],
  ] as const)("shows the retire reason (%s) with the distance and no rank (issue #443)", (reason, title) => {
    finishWith(goalResult({ outcome: "retire", retireReason: reason, rank: null, distanceMeters: 123.4 }));
    render(<ResultScreen />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText("到達距離: 123 m")).toBeInTheDocument();
    expect(screen.getByText("最大衝撃: 2.50 G")).toBeInTheDocument();
    expect(screen.queryByText("走破タイム: 12.3 秒")).not.toBeInTheDocument();
  });
});
