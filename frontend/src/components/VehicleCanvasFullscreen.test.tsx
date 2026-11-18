import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CloseFullscreenButton } from "./VehicleCanvasFullscreen";

describe("CloseFullscreenButton", () => {
  it("押すとonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    render(<CloseFullscreenButton onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "フルスクリーンを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
