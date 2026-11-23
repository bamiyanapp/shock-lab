import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanels, SettingsTabList } from "./SettingsTabs";
import { useSettingsTabs } from "./useSettingsTabs";
import type { SettingsTab } from "./useSettingsTabs";

const TABS: SettingsTab[] = [
  { id: "a", label: "試験条件", content: <p>パネルA</p> },
  { id: "b", label: "車両パラメータ", content: <input aria-label="入力B" /> },
];

// 見出し（固定側）とパネル（スクロール側）を、フックで連携させる。Homeと同じ組み立て。
function Harness() {
  const tabs = useSettingsTabs(TABS.length);
  return (
    <div>
      <SettingsTabList tabs={TABS} activeIndex={tabs.activeIndex} onSelect={tabs.goTo} />
      <SettingsPanels tabs={TABS} scrollerRef={tabs.scrollerRef} onScroll={tabs.handleScroll} />
    </div>
  );
}

describe("設定の切り替え（issue #550）", () => {
  it("2つのタブと、対応する2つのパネルが表示される。最初は先頭のタブが選択されている", () => {
    render(<Harness />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "試験条件" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "車両パラメータ" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getAllByRole("tabpanel", { hidden: true })[0]).toBeInTheDocument();
  });

  it("全てのパネルが常にマウントされている（切り替えても、入力中の状態が消えない）", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("入力B", { selector: "input" });
    await user.type(input, "abc");

    await user.click(screen.getByRole("tab", { name: "車両パラメータ" }));
    await user.click(screen.getByRole("tab", { name: "試験条件" }));

    expect(screen.getByLabelText("入力B", { selector: "input" })).toHaveValue("abc");
  });

  it("タブを押すと、選択が移り、そのパネルへ横スクロールする", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "車両パラメータ" }));

    expect(screen.getByRole("tab", { name: "車両パラメータ" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "試験条件" })).toHaveAttribute("aria-selected", "false");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
  });

  it("スワイプでスクロールが動くと、見えているパネルに合わせて、選択が更新される", () => {
    render(<Harness />);
    const scroller = screen.getByTestId("settings-scroller");
    Object.defineProperty(scroller, "clientWidth", { value: 300, configurable: true });

    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);

    expect(screen.getByRole("tab", { name: "車両パラメータ" })).toHaveAttribute("aria-selected", "true");
  });

  it("横スクロールの領域は、キーボードでも操作できる（フォーカスできる）", () => {
    render(<Harness />);
    expect(screen.getByTestId("settings-scroller")).toHaveAttribute("tabindex", "0");
  });
});
