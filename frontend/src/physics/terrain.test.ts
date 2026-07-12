import { describe, expect, it } from "vitest";
import type Matter from "matter-js";
import { createTerrain } from "./terrain";

function bodyHeight(body: Matter.Body) {
  return body.bounds.max.y - body.bounds.min.y;
}

describe("createTerrain", () => {
  it("creates a single flat ground body for the flat terrain type", () => {
    const bodies = createTerrain("flat", 300);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].isStatic).toBe(true);
  });

  it("creates multiple repeating bump obstacles for bump terrain types", () => {
    const bodies = createTerrain("smallBump", 300);
    const bumpCount = bodies.filter((body) => bodyHeight(body) > 100).length;
    expect(bumpCount).toBeGreaterThan(1);
  });

  it("makes hugeSpeedBump bumps taller than smallBump bumps", () => {
    const smallBodies = createTerrain("smallBump", 300);
    const hugeBodies = createTerrain("hugeSpeedBump", 300);
    const maxSmallHeight = Math.max(...smallBodies.map(bodyHeight));
    const maxHugeHeight = Math.max(...hugeBodies.map(bodyHeight));
    expect(maxHugeHeight).toBeGreaterThan(maxSmallHeight);
  });
});
