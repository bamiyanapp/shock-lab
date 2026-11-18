import { describe, expect, it } from "vitest";
import { getCanvasStyle } from "./canvasLayout";

describe("getCanvasStyle", () => {
  it("待機中は画面幅に収める", () => {
    expect(getCanvasStyle(false, true)).toEqual({ maxWidth: "100%", height: "auto" });
  });

  it("走行中の横持ちは回転しない", () => {
    expect(getCanvasStyle(true, false).transform).toBeUndefined();
  });

  it("走行中の縦持ちは90度回転する", () => {
    expect(getCanvasStyle(true, true).transform).toBe("rotate(90deg)");
  });
});
