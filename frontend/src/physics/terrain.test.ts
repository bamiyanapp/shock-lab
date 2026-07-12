import { describe, expect, it } from "vitest";
import { createTerrain } from "./terrain";

describe("createTerrain", () => {
  it("creates a single flat ground body for the flat terrain type", () => {
    const bodies = createTerrain("flat", 300);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].isStatic).toBe(true);
  });

  it("creates a bump obstacle for bump terrain types", () => {
    const bodies = createTerrain("smallBump", 300);
    expect(bodies).toHaveLength(3);
  });
});
