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

    await user.click(screen.getByRole("radio", { name: "洗濯板（波状路）" }));

    expect(useSimulationStore.getState().testConditions.terrainType).toBe("washboard");
    expect(useSimulationStore.getState().phase).toBe("idle");
  });

  it("6種類の路面を、ラジオボタンで日本語ラベルのまま選べる（issue #539）", () => {
    render(<TestConditionsPanel />);
    const labels = screen.getAllByRole("radio").map((radio) => radio.parentElement?.textContent);
    expect(labels).toEqual([
      "平坦路",
      "小さい段差",
      "大きい段差",
      "巨大スピードバンプ",
      "洗濯板（波状路）",
      "ジャンプ台",
    ]);
    expect(screen.getByRole("group", { name: "路面" })).toBeInTheDocument();
  });

  it("既定の路面が選択状態になり、選ぶと選択が移る（ラジオは1つだけ選択）", async () => {
    const user = userEvent.setup();
    render(<TestConditionsPanel />);
    expect(useSimulationStore.getState().testConditions.terrainType).toBe("smallBump");
    expect(screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "小さい段差" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "ジャンプ台" }));

    expect(screen.getByRole("radio", { name: "ジャンプ台" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "小さい段差" })).not.toBeChecked();
  });

  it("各選択肢に、路面のアイコン（装飾のSVG）がある", () => {
    const { container } = render(<TestConditionsPanel />);
    const icons = container.querySelectorAll("svg[data-terrain-icon]");
    expect(icons).toHaveLength(6);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
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
