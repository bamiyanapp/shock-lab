import type { TerrainType } from "../types/vehicle";

/** アイコンのSVGの座標系（幅×高さ）。地面の基準線はGROUND_Y */
export const TERRAIN_ICON_WIDTH = 48;
export const TERRAIN_ICON_HEIGHT = 24;
const GROUND_Y = 18;

/**
 * 路面の断面を表すアイコンの多角形の頂点（SVGのpolygon用）。左下から、路面の上面を右へたどり、
 * 右下で閉じる。形は実際の地形（physics/terrain.ts）に近づけている。
 */
function profile(...surface: Array<[number, number]>): string {
  const points: Array<[number, number]> = [[0, TERRAIN_ICON_HEIGHT], ...surface, [TERRAIN_ICON_WIDTH, TERRAIN_ICON_HEIGHT]];
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** 洗濯板: 小さな矩形の連続 */
function washboardSurface(): Array<[number, number]> {
  const points: Array<[number, number]> = [[0, GROUND_Y]];
  for (let x = 4; x < TERRAIN_ICON_WIDTH - 4; x += 8) {
    points.push([x, GROUND_Y], [x, GROUND_Y - 3], [x + 4, GROUND_Y - 3], [x + 4, GROUND_Y]);
  }
  points.push([TERRAIN_ICON_WIDTH, GROUND_Y]);
  return points;
}

/** 巨大スピードバンプ: 半コサインの、丸い山形（physics/terrain.tsの断面と同じ形） */
function domeSurface(): Array<[number, number]> {
  const left = 8;
  const right = 40;
  const peak = 8;
  const points: Array<[number, number]> = [[0, GROUND_Y]];
  const steps = 16;
  for (let i = 0; i <= steps; i += 1) {
    const x = left + ((right - left) * i) / steps;
    const y = GROUND_Y - ((GROUND_Y - peak) * (1 + Math.cos((Math.PI * (x - (left + right) / 2)) / ((right - left) / 2)))) / 2;
    points.push([x, Number(y.toFixed(2))]);
  }
  points.push([TERRAIN_ICON_WIDTH, GROUND_Y]);
  return points;
}

export const TERRAIN_ICON_POINTS: Record<TerrainType, string> = {
  flat: profile([0, GROUND_Y], [TERRAIN_ICON_WIDTH, GROUND_Y]),
  smallBump: profile([0, GROUND_Y], [18, GROUND_Y], [18, 15], [30, 15], [30, GROUND_Y], [TERRAIN_ICON_WIDTH, GROUND_Y]),
  largeBump: profile([0, GROUND_Y], [18, GROUND_Y], [18, 9], [30, 9], [30, GROUND_Y], [TERRAIN_ICON_WIDTH, GROUND_Y]),
  hugeSpeedBump: profile(...domeSurface()),
  washboard: profile(...washboardSurface()),
  jumpRamp: profile([0, GROUND_Y], [10, GROUND_Y], [36, 5], [36, GROUND_Y], [TERRAIN_ICON_WIDTH, GROUND_Y]),
};
