import { useEffect } from "react";
import { useSimulationStore } from "../store/simulationStore";

// アプリがバックグラウンドへ回ったとき（visibilityStateがhidden）、走行中なら一時停止する。
// エンジン音は走行中の状態に連動して止まる。復帰時の自動再開はしない（issue #443）。
export function usePauseWhenHidden() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") useSimulationStore.getState().pauseRun();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
