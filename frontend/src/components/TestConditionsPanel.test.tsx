import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestConditionsPanel } from "./TestConditionsPanel";
import { useSimulationStore } from "../store/simulationStore";

describe("TestConditionsPanel（issue #445）", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it("路面を選ぶとストアのterrainTypeが変わり、走行は未開始に戻る", async () => {
    const user = userEvent.setup();
    render(<TestConditionsPanel />);
    useSimulationStore.getState().startRun();

    await user.selectOptions(screen.getByLabelText("路面"), "washboard");

    expect(useSimulationStore.getState().testConditions.terrainType).toBe("washboard");
    expect(useSimulationStore.getState().phase).toBe("idle");
  });

  it("6種類の路面を日本語ラベルで選べる", () => {
    render(<TestConditionsPanel />);
    const labels = screen.getAllByRole("option").map((option) => option.textContent);
    expect(labels).toEqual([
      "平坦路",
      "小さい段差",
      "大きい段差",
      "巨大スピードバンプ",
      "洗濯板（波状路）",
      "ジャンプ台",
    ]);
  });

  it("速度スライダーを動かすとストアのspeedが変わり、km/h換算を表示する", () => {
    render(<TestConditionsPanel />);
    expect(screen.getByText("36 km/h")).toBeInTheDocument();

    const speedSlider = screen.getByRole("slider", { name: /試験速度/ });
    fireEvent.change(speedSlider, { target: { value: "20" } });

    expect(useSimulationStore.getState().testConditions.speed).toBe(20);
    expect(screen.getByText("72 km/h")).toBeInTheDocument();
  });
});
