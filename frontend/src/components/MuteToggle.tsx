import type { CSSProperties } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { applyEngineSoundMuted } from "../audio/engineSound";

// クリック音・衝撃音・エンジン音等すべてのサウンドフィードバックのミュートトグル（issue #53）。
// 操作ボタン欄とフルスクリーン中のHUDの両方で使う（issue #443）。
export function MuteToggle({
  className = "btn btn-outline-secondary",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const isMuted = useSimulationStore((state) => state.isMuted);
  const setMuted = useSimulationStore((state) => state.setMuted);

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label="ミュート"
      aria-pressed={isMuted}
      onClick={() => {
        setMuted(!isMuted);
        applyEngineSoundMuted();
      }}
    >
      {isMuted ? "🔇" : "🔊"}
    </button>
  );
}
