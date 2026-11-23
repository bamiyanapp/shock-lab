import { describe, expect, it } from "vitest";
import { TERRAIN_TYPES } from "../store/parameterRanges";
import { TERRAIN_ICON_HEIGHT, TERRAIN_ICON_POINTS, TERRAIN_ICON_WIDTH } from "./terrainIcons";

function parse(points: string): Array<[number, number]> {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y];
  });
}

describe("TERRAIN_ICON_POINTS", () => {
  it("全ての路面にアイコンがある", () => {
    for (const terrainType of TERRAIN_TYPES) expect(TERRAIN_ICON_POINTS[terrainType]).toBeTruthy();
  });

  it("頂点は全て、アイコンの範囲内にあり、左下と右下で閉じる", () => {
    for (const terrainType of TERRAIN_TYPES) {
      const points = parse(TERRAIN_ICON_POINTS[terrainType]);
      expect(points[0]).toEqual([0, TERRAIN_ICON_HEIGHT]);
      expect(points.at(-1)).toEqual([TERRAIN_ICON_WIDTH, TERRAIN_ICON_HEIGHT]);
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(TERRAIN_ICON_WIDTH);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(TERRAIN_ICON_HEIGHT);
      }
    }
  });

  it("路面の高さが、小さい段差<大きい段差<巨大スピードバンプの順に高い", () => {
    const top = (type: (typeof TERRAIN_TYPES)[number]) => Math.min(...parse(TERRAIN_ICON_POINTS[type]).map(([, y]) => y));
    expect(top("smallBump")).toBeGreaterThan(top("largeBump"));
    expect(top("largeBump")).toBeGreaterThan(top("hugeSpeedBump"));
    expect(top("flat")).toBeGreaterThan(top("smallBump"));
  });
});
