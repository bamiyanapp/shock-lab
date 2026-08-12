import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulationControls } from "./SimulationControls";
import { useSimulationStore } from "../store/simulationStore";

describe("SimulationControls", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("starts stopped and shows a 開始 button", () => {
    render(<SimulationControls />);
    expect(useSimulationStore.getState().isRunning).toBe(false);
    expect(screen.getByRole("button", { name: "開始" })).toBeInTheDocument();
  });

  it("toggles isRunning and the button label when clicked", async () => {
    const user = userEvent.setup();
    render(<SimulationControls />);

    await user.click(screen.getByRole("button", { name: "開始" }));
    expect(useSimulationStore.getState().isRunning).toBe(true);
    expect(screen.getByRole("button", { name: "一時停止" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "一時停止" }));
    expect(useSimulationStore.getState().isRunning).toBe(false);
  });

  it("shows separate 再開/最初から buttons after pausing instead of 開始", async () => {
    const user = userEvent.setup();
    render(<SimulationControls />);

    await user.click(screen.getByRole("button", { name: "開始" }));
    await user.click(screen.getByRole("button", { name: "一時停止" }));

    expect(screen.queryByRole("button", { name: "開始" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再開" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初から" })).toBeInTheDocument();
  });

  it("再開 resumes without touching runToken or clearing history", async () => {
    const user = userEvent.setup();
    render(<SimulationControls />);

    await user.click(screen.getByRole("button", { name: "開始" }));
    useSimulationStore.getState().setMetrics({
      speed: 5,
      suspensionStroke: 0,
      rearSuspensionStroke: 0,
      verticalG: 0,
      maxImpact: 0,
      isBottomedOut: false,
      bottomOutCount: 0,
    });
    await user.click(screen.getByRole("button", { name: "一時停止" }));
    const runTokenBeforeResume = useSimulationStore.getState().runToken;

    await user.click(screen.getByRole("button", { name: "再開" }));

    expect(useSimulationStore.getState().isRunning).toBe(true);
    expect(useSimulationStore.getState().runToken).toBe(runTokenBeforeResume);
    expect(useSimulationStore.getState().metricsHistory).toHaveLength(1);
  });

  it("最初から increments runToken, clears history, and starts running", async () => {
    const user = userEvent.setup();
    render(<SimulationControls />);

    await user.click(screen.getByRole("button", { name: "開始" }));
    useSimulationStore.getState().setMetrics({
      speed: 5,
      suspensionStroke: 0,
      rearSuspensionStroke: 0,
      verticalG: 0,
      maxImpact: 0,
      isBottomedOut: false,
      bottomOutCount: 0,
    });
    await user.click(screen.getByRole("button", { name: "一時停止" }));
    const runTokenBeforeRestart = useSimulationStore.getState().runToken;

    await user.click(screen.getByRole("button", { name: "最初から" }));

    expect(useSimulationStore.getState().isRunning).toBe(true);
    expect(useSimulationStore.getState().runToken).toBe(runTokenBeforeRestart + 1);
    expect(useSimulationStore.getState().metricsHistory).toHaveLength(0);
  });
});
