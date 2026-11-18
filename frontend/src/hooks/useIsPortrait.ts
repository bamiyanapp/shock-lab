import { useEffect, useState } from "react";

const PORTRAIT_QUERY = "(orientation: portrait)";

function readIsPortrait(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(PORTRAIT_QUERY).matches
    : false;
}

// 画面が縦向きかどうかを返す。iOS Safariは画面の向きをスクリプトで固定できないため、
// 縦持ち時はCSSで走行画面を回転させる判定に使う。matchMedia非対応環境では横向き扱い。
export function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState(readIsPortrait);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PORTRAIT_QUERY);
    const handleChange = () => setIsPortrait(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isPortrait;
}
