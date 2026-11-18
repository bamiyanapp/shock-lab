import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsPortrait } from "./useIsPortrait";

function stubMatchMedia(initial: boolean) {
  let listener: (() => void) | undefined;
  const query = {
    matches: initial,
    addEventListener: (_: string, l: () => void) => (listener = l),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => query);
  return {
    set(next: boolean) {
      query.matches = next;
      listener?.();
    },
  };
}

describe("useIsPortrait", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("初期値と向きの変化に追従する", () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useIsPortrait());
    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it("matchMedia非対応環境では横向き扱いで例外を投げない", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useIsPortrait());
    expect(result.current).toBe(false);
  });
});
