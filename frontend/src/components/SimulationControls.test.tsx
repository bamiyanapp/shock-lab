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
    expect(screen.getByRole("button", { name: "開始" })).toBeInTheDocument();
  });
});
