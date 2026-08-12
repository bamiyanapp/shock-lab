import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  afterEach(() => {
    cleanup();
    // @ts-expect-error -- テスト用にjsdomへserviceWorkerを後付けしたものを除去する
    delete navigator.serviceWorker;
  });

  it("registers sw.js under the configured BASE_URL, not the domain root", () => {
    const register = vi.fn().mockResolvedValue({ update: vi.fn() });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      configurable: true,
    });

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}sw.js`);
  });

  it("does nothing when the browser has no serviceWorker support", () => {
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});
