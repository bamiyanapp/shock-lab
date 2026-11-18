import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphPanel } from "./GraphPanel";
import { useSimulationStore } from "../store/simulationStore";

// jsdomにはレイアウトが無くResponsiveContainerが描画しないため、チャート自体は軽量なモックへ置き換え、
// 走行状態による表示の出し分けだけを検証する。
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div>,
    LineChart: () => null,
  };
});

describe("GraphPanel（issue #447）", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("走行中はグラフを描画せず「走行中…」を表示する", () => {
    useSimulationStore.getState().startRun();
    render(<GraphPanel />);
    expect(screen.getByText(/走行中…/)).toBeInTheDocument();
    expect(screen.queryByTestId("metrics-graphs")).not.toBeInTheDocument();
  });

  it("一時停止中は上下Gとストロークの2つのグラフを表示する", () => {
    useSimulationStore.getState().startRun();
    useSimulationStore.getState().pauseRun();
    render(<GraphPanel />);
    expect(screen.queryByText(/走行中…/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("chart")).toHaveLength(2);
  });

  it("終了後も2つのグラフを表示する", () => {
    useSimulationStore.getState().startRun();
    useSimulationStore.getState().finishRun({
      outcome: "goal",
      rank: "A",
      maxImpact: 1,
      bottomOutCount: 0,
      averageAbsVerticalG: 0.1,
      elapsedSeconds: 30,
      distanceMeters: 300,
    });
    render(<GraphPanel />);
    expect(screen.getAllByTestId("chart")).toHaveLength(2);
  });
});
