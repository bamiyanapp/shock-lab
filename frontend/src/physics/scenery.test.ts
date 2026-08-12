import { describe, expect, it } from "vitest";
import { createScenery, createParallaxLayers } from "./scenery";

describe("createScenery", () => {
  it("places scenery items across the course at strictly increasing world x positions", () => {
    const items = createScenery(1000, 100);
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].worldX).toBe(100);
    for (let i = 1; i < items.length; i += 1) {
      expect(items[i].worldX).toBeGreaterThan(items[i - 1].worldX);
    }
  });

  it("mixes houses in among trees", () => {
    const items = createScenery(2000);
    expect(items.some((item) => item.kind === "house")).toBe(true);
    expect(items.some((item) => item.kind === "tree")).toBe(true);
  });

  it("returns no items when the course is shorter than the start offset", () => {
    expect(createScenery(50, 300)).toEqual([]);
  });
});

describe("createParallaxLayers", () => {
  it("returns multiple layers with speedFactor strictly less than 1 (slower than the foreground)", () => {
    const layers = createParallaxLayers(3000);
    expect(layers.length).toBeGreaterThan(1);
    for (const layer of layers) {
      expect(layer.speedFactor).toBeGreaterThan(0);
      expect(layer.speedFactor).toBeLessThan(1);
      expect(layer.items.length).toBeGreaterThan(0);
    }
  });

  it("gives farther layers (lower speedFactor) a distinct kind from nearer layers", () => {
    const [farthest, ...rest] = [...createParallaxLayers(3000)].sort(
      (a, b) => a.speedFactor - b.speedFactor
    );
    expect(farthest.items[0].kind).toBe("mountain");
    expect(rest.every((layer) => layer.items[0].kind !== farthest.items[0].kind)).toBe(true);
  });

  it("places items at strictly increasing world x positions within each layer", () => {
    for (const layer of createParallaxLayers(3000)) {
      for (let i = 1; i < layer.items.length; i += 1) {
        expect(layer.items[i].worldX).toBeGreaterThan(layer.items[i - 1].worldX);
      }
    }
  });
});
