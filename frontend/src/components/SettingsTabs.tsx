import type { RefObject } from "react";

import type { SettingsTab } from "./useSettingsTabs";

/** タブ見出し。横スクロールに気づきにくいため、押すとそのパネルへ移動する見出しを付ける。 */
export function SettingsTabList({
  tabs,
  activeIndex,
  onSelect,
}: {
  tabs: SettingsTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div role="tablist" aria-label="設定の切り替え" className="nav nav-pills nav-fill gap-2 w-100">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`settings-tab-${tab.id}`}
          aria-selected={index === activeIndex}
          aria-controls={`settings-panel-${tab.id}`}
          className={`nav-link${index === activeIndex ? " active" : ""}`}
          onClick={() => onSelect(index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** 横に並べたパネル。切り替えはタブ見出しのボタンだけで、スワイプは無効。全てのパネルを常にマウントし、切り替えで状態が消えないようにする。 */
export function SettingsPanels({
  tabs,
  scrollerRef,
  onScroll,
}: {
  tabs: SettingsTab[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  return (
    // 切り替えはタブ見出しのボタンだけにする。スライダーの横ドラッグと、スワイプが競合するため
    // overflow-x: hiddenにして、ユーザーのスクロール操作を無効にする（issue #570）。
    // タブ見出しからの切り替えと、フォーカス移動による位置ずれは、プログラムからのスクロールで扱える。
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      data-testid="settings-scroller"
      style={{
        display: "flex",
        // 親が縦並びのflexのため、min-width:0がないと中身の幅（2枚ぶん）まで広がり、ページが横にあふれる。
        minWidth: 0,
        width: "100%",
        // btn-checkのinputはposition:absoluteのため、これがないと、スクロール領域の外へはみ出し、ページが横に広がる。
        position: "relative",
        alignItems: "flex-start",
        overflowX: "hidden",
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`settings-panel-${tab.id}`}
          aria-labelledby={`settings-tab-${tab.id}`}
          style={{ flex: "0 0 100%", minWidth: 0, paddingInline: 2 }}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
