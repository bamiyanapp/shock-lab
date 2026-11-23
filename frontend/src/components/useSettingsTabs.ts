import { useRef, useState } from "react";
import type { ReactNode } from "react";

export interface SettingsTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * 設定の切り替え（issue #550）。複数のパネルを横に並べ、横スクロール（スワイプ）で1枚ずつ切り替える。
 * タブ見出し（SettingsTabList）は、プレビューと一緒に画面の上へ固定し、パネル（SettingsPanels）は
 * ページとともにスクロールさせる。そのため、見出しとパネルを別のコンポーネントにし、状態は
 * このフックで共有する。
 */
export function useSettingsTabs(tabCount: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = (index: number) => {
    setActiveIndex(index);
    const scroller = scrollerRef.current;
    if (scroller && typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ left: index * scroller.clientWidth, behavior: "smooth" });
    }
  };

  // スワイプで動いたとき、見えているパネルに合わせて、タブの選択を更新する。
  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    if (index >= 0 && index < tabCount && index !== activeIndex) setActiveIndex(index);
  };

  return { scrollerRef, activeIndex, goTo, handleScroll };
}
