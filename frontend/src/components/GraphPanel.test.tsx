import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { GraphPanel } from "./GraphPanel";
import { shouldShowMetrics } from "./metricsVisibility";
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

  it("走行前（idle）は、メトリクスを表示しない（見出しも領域も出さない）（issue #553）", () => {
    const { container } = render(<GraphPanel />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("メトリクス")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metrics-graphs")).not.toBeInTheDocument();
  });

  it("走行中は、メトリクスを表示しない（フルスクリーンで見えないため）", () => {
    useSimulationStore.getState().startRun();
    const { container } = render(<GraphPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("一時停止中は上下Gとストロークの2つのグラフを表示する", () => {
    useSimulationStore.getState().startRun();
    useSimulationStore.getState().pauseRun();
    render(<GraphPanel />);
    expect(screen.getByText("メトリクス")).toBeInTheDocument();
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

  it("設定を変えて走行が未開始へ戻ると、前回のメトリクスは消える", () => {
    useSimulationStore.getState().startRun();
    useSimulationStore.getState().pauseRun();
    const { container } = render(<GraphPanel />);
    expect(screen.getAllByTestId("chart")).toHaveLength(2);

    act(() => useSimulationStore.getState().setTestConditions({ speed: 20 }));

    expect(container).toBeEmptyDOMElement();
  });
});

describe("shouldShowMetrics（issue #553）", () => {
  it("一時停止中と終了後だけ表示する", () => {
    expect(shouldShowMetrics("idle")).toBe(false);
    expect(shouldShowMetrics("running")).toBe(false);
    expect(shouldShowMetrics("paused")).toBe(true);
    expect(shouldShowMetrics("finished")).toBe(true);
  });
});
