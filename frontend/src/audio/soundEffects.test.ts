import { describe, expect, it, vi, beforeEach } from "vitest";
import { clickSound } from "./soundEffects";
import { useSimulationStore } from "../store/simulationStore";

describe("soundEffects", () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
    useSimulationStore.getState().setMuted(false);
  });

  it("plays the underlying audio element when not muted", () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    clickSound.play();

    expect(playSpy).toHaveBeenCalledTimes(1);
    playSpy.mockRestore();
  });

  it("does not play the underlying audio element when muted (issue #53)", () => {
    useSimulationStore.getState().setMuted(true);
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    clickSound.play();

    expect(playSpy).not.toHaveBeenCalled();
    playSpy.mockRestore();
  });
});
