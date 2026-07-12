import { describe, expect, it } from "vitest";
import { createScenery } from "./scenery";

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
