import { useSimulationStore } from "../store/simulationStore";
import { MuteToggle } from "./MuteToggle";

// iPhoneでタップしやすいよう、ボタンは44px四方以上にする。
const HUD_BUTTON_STYLE = { minWidth: 44, minHeight: 44 } as const;
const HUD_TEXT_STYLE = {
  color: "#f8fafc",
  textShadow: "0 0 3px #000",
  fontSize: 14,
  lineHeight: 1.4,
  pointerEvents: "none",
} as const;
const KMH_PER_MS = 3.6;

// 閉じるボタン（✕）は一時停止と同じ意味（走行状態をpausedにする）を持たせ、専用の状態を
// 増やさず走行状態のみを表示モードの判定に使う。
export function CloseFullscreenButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-light"
      style={HUD_BUTTON_STYLE}
      aria-label="フルスクリーンを閉じる"
      onClick={onClose}
    >
      ✕
    </button>
  );
}

// フルスクリーン中に重ねて表示する情報と操作（issue #443）。左上に速度・上下G・底付き回数、
// 右上にミュートと一時停止（✕）を置く。
export function FullscreenHud({ onPause }: { onPause: () => void }) {
  const metrics = useSimulationStore((state) => state.metrics);

  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, margin: 8, ...HUD_TEXT_STYLE }}>
        <div>速度: {(metrics.speed * KMH_PER_MS).toFixed(0)} km/h</div>
        <div>上下G: {metrics.verticalG.toFixed(2)} G</div>
        <div>底付き: {metrics.bottomOutCount} 回</div>
      </div>
      <div className="d-flex gap-2" style={{ position: "absolute", top: 0, right: 0, margin: 8 }}>
        <MuteToggle className="btn btn-light" style={HUD_BUTTON_STYLE} />
        <CloseFullscreenButton onClose={onPause} />
      </div>
    </>
  );
}
