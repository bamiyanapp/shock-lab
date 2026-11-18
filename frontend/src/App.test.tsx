import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

function Broken(): never {
  throw new Error("boom");
}

// アプリ全体をErrorBoundaryで包む構成（issue #449）で、描画例外時に白画面ではなく
// 再読み込みボタン付きのフォールバックが出ることを確認する。
describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("子が例外を投げるとフォールバックと再読み込みボタンを表示する", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByText("エラーが発生しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });
});
