import type { CSSProperties } from "react";

// iOS Safariのアドレスバー分のずれを避けるため、対応環境では100dvhを使う（非対応は100vh）。
function viewportHeightUnit(): string {
  return typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh") ? "100dvh" : "100vh";
}

// 待機中は画面幅に収める。走行中（フルスクリーン）は画面内に収め、縦持ちの場合は
// 長辺を画面の高さへ合わせるため90度回転させる（閉じるボタンは回転させない）。
export function getCanvasStyle(isRunning: boolean, isPortrait: boolean): CSSProperties {
  if (!isRunning) return { maxWidth: "100%", height: "auto" };
  if (!isPortrait) return { maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "auto" };
  return {
    width: viewportHeightUnit(),
    maxHeight: "100vw",
    height: "auto",
    flexShrink: 0,
    transform: "rotate(90deg)",
  };
}
