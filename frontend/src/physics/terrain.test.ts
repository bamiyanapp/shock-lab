import { createPreviewObstacles } from "./terrain";
import { describe, expect, it } from "vitest";
import type Matter from "matter-js";
import {
  createTerrain,
  roundCorners,
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

  it("hugeSpeedBump: 台形でなく、半コサインの、丸い山形（24個の短冊の複合ボディ）。両端は地面になめらかにつながる（issue #590）", () => {
    const [bump] = obstaclesOf("hugeSpeedBump");
    // 幅は360（短冊の重なりぶん、わずかに広い）。下端は、地面の厚みぶん、地中へ延びる
    expect(bump.bounds.max.x - bump.bounds.min.x).toBeCloseTo(361, 5);
    expect(bump.bounds.max.y).toBeGreaterThan(GROUND_Y);
    expect(bump.parts.length - 1).toBe(24);
    // 地面の高さに、最も近い両端の上面は、ほぼ地面と同じ高さ（段差がない）
    const topAt = (nearX: number) => Math.min(...bump.vertices.filter((v) => Math.abs(v.x - nearX) < 1).map((v) => v.y));
    expect(topAt(bump.bounds.min.x + 0.5)).toBeGreaterThan(GROUND_Y - 1);
    expect(topAt(bump.bounds.max.x - 0.5)).toBeGreaterThan(GROUND_Y - 1);
    // 頂上は丸く、中央に最も高い点がある。平らな上面は、持たない
    const apexX = (bump.bounds.min.x + bump.bounds.max.x) / 2;
    expect(Math.abs(topAt(apexX) - bump.bounds.min.y)).toBeLessThan(1e-6);
    expect(topAt(apexX + 60)).toBeGreaterThan(bump.bounds.min.y + 1);
  });

  it("jumpRamp: 直角三角形の上り斜面で、最も低い頂点が地面上面に一致し、頂点の先は垂直に落ちる。先端は丸い（issue #579）", () => {
    const [ramp] = obstaclesOf("jumpRamp");
    expect(ramp.bounds.max.y).toBeCloseTo(GROUND_Y, 5);
    expect(ramp.bounds.max.x - ramp.bounds.min.x).toBeCloseTo(300, 5);
    // 最も高い点は、右端の近くにある。先端を丸めるため、右端そのものではなく、少し手前にある
    const apex = ramp.vertices.reduce((best, vertex) => (vertex.y < best.y ? vertex : best));
    expect(apex.x).toBeLessThanOrEqual(ramp.bounds.max.x);
    expect(ramp.bounds.max.x - apex.x).toBeLessThan(12 + 1e-6);
    // 右端は、垂直に落ちる壁のまま（右端上の頂点が、複数ある）
    const wall = ramp.vertices.filter((vertex) => Math.abs(vertex.x - ramp.bounds.max.x) < 1e-6);
    expect(wall.length).toBeGreaterThanOrEqual(2);
    expect(ramp.vertices.length).toBeGreaterThanOrEqual(3 - 1 + 7);
  });

  it.each(["smallBump", "largeBump", "washboard"] as const)(
    "%s: 上側の2つの角が丸く、平らな上面は、幅より短い。下側は、地中まで延びる（issue #579）",
    (terrain) => {
      const [bump] = obstaclesOf(terrain);
      const width = bump.bounds.max.x - bump.bounds.min.x;
      const flatTop = bump.vertices.filter((vertex) => vertex.y < bump.bounds.min.y + 1e-6);
      const flatWidth = Math.max(...flatTop.map((v) => v.x)) - Math.min(...flatTop.map((v) => v.x));
      expect(flatWidth).toBeLessThan(width - 1e-3);
      expect(bump.vertices.length).toBeGreaterThanOrEqual(4 - 2 + 2 * 7);
      expect(bump.bounds.max.y).toBeGreaterThan(GROUND_Y);
    }
  );

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

describe("createPreviewObstacles（issue #551）", () => {
  const TYPES = ["flat", "smallBump", "largeBump", "hugeSpeedBump", "washboard", "jumpRamp"] as const;

  it("平坦路は障害物なし。他の路面は、障害物がある", () => {
    expect(createPreviewObstacles("flat", 300)).toHaveLength(0);
    for (const type of TYPES.filter((candidate) => candidate !== "flat")) {
      expect(createPreviewObstacles(type, 300).length).toBeGreaterThan(0);
    }
  });

  it("障害物は、待機中に見える範囲（車の前方、画面幅800の内側）から始まり、最初の1つは全体が収まる", () => {
    for (const type of TYPES.filter((candidate) => candidate !== "flat")) {
      const bodies = createPreviewObstacles(type, 300);
      for (const body of bodies) {
        expect(body.bounds.min.x).toBeGreaterThan(300);
        expect(body.bounds.min.x).toBeLessThan(800);
      }
      expect(bodies[0].bounds.max.x).toBeLessThanOrEqual(800);
    }
  });

  it("障害物の形・高さが、路面ごとに異なる（小さい段差<大きい段差<巨大スピードバンプ）", () => {
    const height = (type: (typeof TYPES)[number]) =>
      Math.max(...createPreviewObstacles(type, 300).map((body) => 300 - body.bounds.min.y));
    expect(height("smallBump")).toBeLessThan(height("largeBump"));
    expect(height("largeBump")).toBeLessThan(height("hugeSpeedBump"));
    expect(height("washboard")).toBeLessThan(height("smallBump"));
  });

  it("実際の地形（createTerrain）は変わらない：最初の障害物は、プレビューより遠い（約25m先）", () => {
    const farthest = Math.min(...createTerrain("smallBump", 300).slice(1).map((body) => body.bounds.min.x));
    expect(farthest).toBeGreaterThan(800);
  });
});

describe("roundCorners（issue #579）", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("半径0の頂点は、そのまま残る。半径が正の頂点は、円弧の頂点に置き換わる", () => {
    const result = roundCorners(square, [0, 10, 0, 0]);
    expect(result).toHaveLength(3 + 7);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    // 丸めた角は、元の角（100, 0）を通らず、内側に入る
    expect(result.some((point) => point.x === 100 && point.y === 0)).toBe(false);
    expect(Math.max(...result.map((p) => p.x))).toBeLessThanOrEqual(100);
  });

  it("半径は、隣の辺の長さの半分までに抑える", () => {
    const result = roundCorners(square, [1000, 0, 0, 0]);
    // 辺の長さ100の半分（50）が上限。円弧の始点は(50, 0)と(0, 50)
    expect(result.some((point) => Math.abs(point.x - 50) < 1e-9 && Math.abs(point.y) < 1e-9)).toBe(true);
    expect(result.some((point) => Math.abs(point.x) < 1e-9 && Math.abs(point.y - 50) < 1e-9)).toBe(true);
  });

  it("丸めた角の頂点は、円弧が、元の角と2つの接点が作る三角形の内側にある", () => {
    const result = roundCorners(square, [0, 20, 0, 0]);
    const arc = result.slice(1, 8);
    for (const point of arc) {
      expect(point.x).toBeGreaterThanOrEqual(80 - 1e-9);
      expect(point.y).toBeLessThanOrEqual(20 + 1e-9);
    }
  });
});
