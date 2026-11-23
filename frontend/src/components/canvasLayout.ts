import type { CSSProperties } from "react";

// iOS Safariのアドレスバー分のずれを避けるため、対応環境では100dvhを使う（非対応は100vh）。
function viewportHeightUnit(): string {
  return typeof CSS !== "undefined" && CSS.supports?.("height", "100dvh") ? "100dvh" : "100vh";
}

// 待機中のプレビューの高さの上限（画面の高さに対する割合）。プレビューを画面の上に固定するため、
// 設定の領域に十分な高さを残す（issue #550）。
const PREVIEW_MAX_HEIGHT_RATIO = 0.4;

// 待機中は画面幅に収める。走行中（フルスクリーン）は画面内に収め、縦持ちの場合は
// 長辺を画面の高さへ合わせるため90度回転させる（閉じるボタンは回転させない）。
export function getCanvasStyle(isRunning: boolean, isPortrait: boolean): CSSProperties {
  // 幅は自動（元の比率を保つ）。画面幅と、画面の高さの40%を超えないように、比率を保ったまま縮める。
  if (!isRunning) {
    return {
      width: "auto",
      height: "auto",
      maxWidth: "100%",
      maxHeight: `calc(${viewportHeightUnit()} * ${PREVIEW_MAX_HEIGHT_RATIO})`,
    };
  }
  if (!isPortrait) return { maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "auto" };
  return {
    width: viewportHeightUnit(),
    maxHeight: "100vw",
    height: "auto",
    flexShrink: 0,
    transform: "rotate(90deg)",
  };
}
