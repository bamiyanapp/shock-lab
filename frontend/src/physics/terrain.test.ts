import { describe, expect, it } from "vitest";
import type Matter from "matter-js";
import {
  createTerrain,
  computeBumpHeight,
  COURSE_LENGTH_PX,
  GOAL_CLEARANCE_PX,
  GOAL_LINE_X_PX,
} from "./terrain";
import type { TerrainType } from "../types/vehicle";

const GROUND_Y = 300;
const ALL_TYPES: TerrainType[] = ["flat", "smallBump", "largeBump", "hugeSpeedBump", "washboard", "jumpRamp"];

// 先頭は全域の地面。それ以降が障害物。
const obstaclesOf = (type: TerrainType) => createTerrain(type, GROUND_Y).slice(1);
// 障害物が地面上面（groundY）から立ち上がっている高さ(px)
const heightAboveGround = (body: Matter.Body) => GROUND_Y - body.bounds.min.y;

describe("createTerrain", () => {
  it("creates only the ground for the flat terrain type", () => {
    const bodies = createTerrain("flat", GROUND_Y);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].isStatic).toBe(true);
  });

  it.each(ALL_TYPES.filter((type) => type !== "flat"))("%s: 地面の上に静止した障害物が複数ある", (type) => {
    const obstacles = obstaclesOf(type);
    expect(obstacles.length).toBeGreaterThan(1);
    expect(obstacles.every((body) => body.isStatic)).toBe(true);
  });

  it.each(ALL_TYPES)("%s: ゴールライン手前500pxには障害物が無い", (type) => {
    for (const body of obstaclesOf(type)) {
      expect(body.bounds.max.x).toBeLessThanOrEqual(GOAL_LINE_X_PX - GOAL_CLEARANCE_PX + 1e-6);
    }
  });

  it.each(ALL_TYPES)("%s: 最初の障害物は x=1500 付近から始まる", (type) => {
    if (type === "flat") return;
    const firstX = Math.min(...obstaclesOf(type).map((body) => body.bounds.min.x));
    expect(firstX).toBeGreaterThanOrEqual(1500 - 200);
    expect(firstX).toBeLessThanOrEqual(1500);
  });

  it("makes hugeSpeedBump obstacles taller than smallBump and largeBump obstacles", () => {
    const maxHeight = (type: TerrainType) => Math.max(...obstaclesOf(type).map(heightAboveGround));
    expect(maxHeight("hugeSpeedBump")).toBeGreaterThan(maxHeight("largeBump"));
    expect(maxHeight("largeBump")).toBeGreaterThan(maxHeight("smallBump"));
  });

  it("makes the first bump shorter than a later bump (progressive bump height)", () => {
    const heights = obstaclesOf("smallBump").map(heightAboveGround);
    expect(heights[0]).toBeLessThan(heights[heights.length - 1]);
  });

  it("washboard: 幅40・高さ一定の障害物が間隔100で連続する", () => {
    const obstacles = obstaclesOf("washboard");
    expect(obstacles.length).toBeGreaterThan(100);
    expect(new Set(obstacles.map(heightAboveGround).map((h) => Math.round(h))).size).toBe(1);
    expect(obstacles[1].bounds.min.x - obstacles[0].bounds.min.x).toBeCloseTo(100, 5);
    expect(obstacles[0].bounds.max.x - obstacles[0].bounds.min.x).toBeCloseTo(40, 5);
  });

  it("hugeSpeedBump: 台形（上底120・下底360）で、最も低い頂点が地面上面に一致する（重心補正）", () => {
    const [bump] = obstaclesOf("hugeSpeedBump");
    expect(bump.bounds.max.y).toBeCloseTo(GROUND_Y, 5);
    expect(bump.bounds.max.x - bump.bounds.min.x).toBeCloseTo(360, 5);
    const topVertices = bump.vertices.filter((vertex) => vertex.y < GROUND_Y - heightAboveGround(bump) + 1e-6);
    expect(Math.max(...topVertices.map((v) => v.x)) - Math.min(...topVertices.map((v) => v.x))).toBeCloseTo(120, 5);
  });

  it("jumpRamp: 直角三角形の上り斜面で、最も低い頂点が地面上面に一致し、頂点の先は垂直に落ちる", () => {
    const [ramp] = obstaclesOf("jumpRamp");
    expect(ramp.bounds.max.y).toBeCloseTo(GROUND_Y, 5);
    expect(ramp.bounds.max.x - ramp.bounds.min.x).toBeCloseTo(300, 5);
    // 最も高い頂点は右端（進行方向の先）にある
    const apex = ramp.vertices.reduce((best, vertex) => (vertex.y < best.y ? vertex : best));
    expect(apex.x).toBeCloseTo(ramp.bounds.max.x, 5);
  });

  it("places the goal line before the course actually ends, leaving solid ground under it", () => {
    expect(GOAL_LINE_X_PX).toBeLessThan(COURSE_LENGTH_PX);
    const bodies = createTerrain("flat", GROUND_Y);
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
    expect(computeBumpHeight(20000, 30)).toBeCloseTo(30, 10);
  });

  it("increases monotonically with bumpCenterX", () => {
    const heights = [1500, 3000, 5000, 8000, 15000].map((x) => computeBumpHeight(x, 80));
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
  });
});
