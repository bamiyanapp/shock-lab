// 閉じるボタンは一時停止と同じ意味（isRunningをfalseにする）を持たせ、専用の状態を
// 増やさずisRunningのみを表示モードの判定に使う。
export function CloseFullscreenButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-light"
      aria-label="フルスクリーンを閉じる"
      onClick={onClose}
      style={{ position: "absolute", top: 0, right: 0, margin: 8 }}
    >
      ✕
    </button>
  );
}
