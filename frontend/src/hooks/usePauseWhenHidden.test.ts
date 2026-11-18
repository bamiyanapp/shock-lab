import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePauseWhenHidden } from "./usePauseWhenHidden";
import { useSimulationStore } from "../store/simulationStore";

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePauseWhenHidden（issue #443）", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });
  afterEach(() => setVisibility("visible"));

  it("走行中にバックグラウンドへ回ると一時停止し、復帰しても自動再開しない", () => {
    renderHook(() => usePauseWhenHidden());
    useSimulationStore.getState().startRun();

    setVisibility("hidden");
    expect(useSimulationStore.getState().phase).toBe("paused");

    setVisibility("visible");
    expect(useSimulationStore.getState().phase).toBe("paused");
  });

  it("走行中でなければ状態を変えない", () => {
    renderHook(() => usePauseWhenHidden());
    setVisibility("hidden");
    expect(useSimulationStore.getState().phase).toBe("idle");
  });
});
