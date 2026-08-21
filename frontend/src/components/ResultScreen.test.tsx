import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultScreen } from "./ResultScreen";
import { useSimulationStore } from "../store/simulationStore";

describe("ResultScreen", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("renders nothing when there is no result yet", () => {
    const { container } = render(<ResultScreen />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the rank and stats once a result is set", () => {
    useSimulationStore.getState().setResult({
      rank: "A",
      maxImpact: 2.5,
      bottomOutCount: 1,
      averageAbsVerticalG: 0.42,
      elapsedSeconds: 12.3,
    });

    render(<ResultScreen />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("最大衝撃: 2.50 G")).toBeInTheDocument();
    expect(screen.getByText("底付き回数: 1 回")).toBeInTheDocument();
    expect(screen.getByText("平均G（乗り心地）: 0.42 G")).toBeInTheDocument();
    expect(screen.getByText("走破タイム: 12.3 秒")).toBeInTheDocument();
  });

  it("もう一度 restarts the run and clears the result", async () => {
    const user = userEvent.setup();
    useSimulationStore.getState().setResult({
      rank: "S",
      maxImpact: 1.0,
      bottomOutCount: 0,
      averageAbsVerticalG: 0.1,
      elapsedSeconds: 10,
    });
    render(<ResultScreen />);

    await user.click(screen.getByRole("button", { name: "もう一度" }));

    expect(useSimulationStore.getState().result).toBeNull();
    expect(useSimulationStore.getState().isRunning).toBe(true);
  });
});
