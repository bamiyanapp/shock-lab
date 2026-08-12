import { describe, expect, it } from "vitest";
import type Matter from "matter-js";
import { createTerrain, computeBumpHeight, COURSE_LENGTH_PX, GOAL_LINE_X_PX } from "./terrain";

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

  it("makes the first bump shorter than a later bump (progressive bump height)", () => {
    const bodies = createTerrain("smallBump", 300);
    const bumpHeights = bodies
      .filter((body) => bodyHeight(body) > 100)
      .map((body) => bodyHeight(body) - 100) // GROUND_THICKNESS_PXぶんを差し引いた実際のバンプ高さ
      .sort((a, b) => a - b);

    expect(bumpHeights[0]).toBeLessThan(bumpHeights[bumpHeights.length - 1]);
  });

  it("places the goal line before the course actually ends, leaving solid ground under it", () => {
    expect(GOAL_LINE_X_PX).toBeLessThan(COURSE_LENGTH_PX);
    const bodies = createTerrain("flat", 300);
    const groundCoversGoalLine = bodies.some(
      (body) => body.bounds.min.x <= GOAL_LINE_X_PX && body.bounds.max.x >= GOAL_LINE_X_PX
    );
    expect(groundCoversGoalLine).toBe(true);
  });
});

describe("computeBumpHeight", () => {
  it("starts at roughly a third of maxHeight for the first bump", () => {
    expect(computeBumpHeight(1500, 30)).toBeCloseTo(10, 5);
  });

  it("reaches maxHeight once far enough into the course", () => {
    expect(computeBumpHeight(20000, 30)).toBe(30);
  });

  it("increases monotonically with bumpCenterX", () => {
    const heights = [1500, 3000, 5000, 8000, 15000].map((x) => computeBumpHeight(x, 80));
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
  });
});
