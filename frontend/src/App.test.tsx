import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

// jsdomはcanvasの2Dコンテキストを提供しないため、Matter.jsの描画を行う
// VehicleCanvasはモックしてUIレイアウトのみを検証する。
vi.mock("./components/VehicleCanvas", () => ({
  VehicleCanvas: () => <div data-testid="vehicle-canvas-stub" />,
}));

describe("App", () => {
  it("renders the ShockLab title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "ShockLab" })).toBeInTheDocument();
  });
});
