import Matter from "matter-js";
import type { TerrainType } from "../types/vehicle";

const GROUND_THICKNESS_PX = 100;
const FIRST_OBSTACLE_X_PX = 1500;

/** 走行コースの総延長（ワールド座標基準）。scenery（背景の木・家）の配置範囲もこれに合わせる。 */
export const COURSE_LENGTH_PX = 20000;

/**
 * ゴールライン位置。物理的な地面自体はCOURSE_LENGTH_PXちょうどで終わるため、
 * ゴール到達時点でまだ地面が残っているよう手前に余裕を持たせる。
 */
export const GOAL_LINE_X_PX = COURSE_LENGTH_PX - 500;

/** ゴールラインの手前、この距離（px）には障害物を置かない */
export const GOAL_CLEARANCE_PX = 500;
const LAST_OBSTACLE_END_X_PX = GOAL_LINE_X_PX - GOAL_CLEARANCE_PX;

// 障害物の見た目は地面・背景と混同しないよう、警告色（アンバー）で明確に色分けする。
const GROUND_OPTIONS: Matter.IChamferableBodyDefinition = {
  isStatic: true,
  friction: 0.8,
  render: { fillStyle: "#52606d" },
};
const OBSTACLE_OPTIONS: Matter.IChamferableBodyDefinition = {
  isStatic: true,
  friction: 0.8,
  render: { fillStyle: "#f59e0b" },
};

/**
 * 序盤は小さい障害物から始め、進行に伴って徐々に高さがmaxHeightへ近づくようにする
 * （最初の障害物位置の序盤は最大値の1/3、5つ目の間隔で最大、それ以降は最大のまま）。
 */
export function computeBumpHeight(bumpCenterX: number, maxHeight: number, spacing = 1200): number {
  const minHeight = maxHeight / 3;
  const progress = Math.min(Math.max((bumpCenterX - FIRST_OBSTACLE_X_PX) / spacing / 5, 0), 1);
  return minHeight + (maxHeight - minHeight) * progress;
}

/** 地面上面を基準に、中心x・幅・高さの矩形バンプを置く（下端は地面の厚みぶん地中へ延ばす） */
function createRectBump(centerX: number, width: number, height: number, groundY: number): Matter.Body {
  const groundCenterY = groundY + GROUND_THICKNESS_PX / 2;
  return Matter.Bodies.rectangle(
    centerX,
    groundCenterY - height / 2,
    width,
    GROUND_THICKNESS_PX + height,
    OBSTACLE_OPTIONS
  );
}

/**
 * 頂点（ワールド座標）から凸多角形の剛体を作る。Bodies.fromVertices は図形の重心を指定座標へ
 * 置くため、頂点配列自身の重心を指定して、頂点がワールド座標のまま配置されるようにする。
 */
function createPolygon(worldVertices: Matter.Vector[]): Matter.Body {
  const centre = Matter.Vertices.centre(worldVertices);
  return Matter.Bodies.fromVertices(centre.x, centre.y, [worldVertices], OBSTACLE_OPTIONS);
}

/** 台形（上底・下底・高さ）。下底が地面上面に接する */
function createTrapezoid(centerX: number, topWidth: number, bottomWidth: number, height: number, groundY: number) {
  return createPolygon([
    { x: centerX - bottomWidth / 2, y: groundY },
    { x: centerX + bottomWidth / 2, y: groundY },
    { x: centerX + topWidth / 2, y: groundY - height },
    { x: centerX - topWidth / 2, y: groundY - height },
  ]);
}

/** 直角三角形の上り斜面。startXから進行方向へ上り、頂点の先は垂直に落ちる */
function createRamp(startX: number, run: number, height: number, groundY: number) {
  return createPolygon([
    { x: startX, y: groundY },
    { x: startX + run, y: groundY },
    { x: startX + run, y: groundY - height },
  ]);
}

/** 一定間隔で障害物を並べる。最後の障害物の端がゴール手前の余白に収まる範囲に限る */
function repeatObstacles(
  spacing: number,
  width: number,
  create: (centerX: number) => Matter.Body
): Matter.Body[] {
  const bodies: Matter.Body[] = [];
  for (let centerX = FIRST_OBSTACLE_X_PX; centerX + width / 2 <= LAST_OBSTACLE_END_X_PX; centerX += spacing) {
    bodies.push(create(centerX));
  }
  return bodies;
}

function createObstacles(terrainType: TerrainType, groundY: number): Matter.Body[] {
  switch (terrainType) {
    case "flat":
      return [];
    case "smallBump":
      return repeatObstacles(1200, 200, (x) => createRectBump(x, 200, computeBumpHeight(x, 6), groundY));
    case "largeBump":
      return repeatObstacles(1200, 200, (x) => createRectBump(x, 200, computeBumpHeight(x, 15), groundY));
    case "hugeSpeedBump":
      return repeatObstacles(1500, 360, (x) =>
        createTrapezoid(x, 120, 360, computeBumpHeight(x, 80, 1500), groundY)
      );
    case "washboard":
      return repeatObstacles(100, 40, (x) => createRectBump(x, 40, 4, groundY));
    case "jumpRamp":
      // 中心xを斜面の水平長の中央として扱い、頂点側が進行方向になるよう置く。
      return repeatObstacles(2500, 300, (x) =>
        createRamp(x - 150, 300, computeBumpHeight(x, 90, 2500), groundY)
      );
  }
}

/**
 * 路面種類ごとの地形をボディ列として生成する。全域に及ぶ地面1枚の上に、種類ごとの障害物
 * （段差・台形のバンプ・洗濯板・ジャンプ台）を一定間隔で並べる。ゴールライン手前には置かない。
 */
export function createTerrain(terrainType: TerrainType, groundY: number): Matter.Body[] {
  const ground = Matter.Bodies.rectangle(
    COURSE_LENGTH_PX / 2,
    groundY + GROUND_THICKNESS_PX / 2,
    COURSE_LENGTH_PX,
    GROUND_THICKNESS_PX,
    GROUND_OPTIONS
  );
  return [ground, ...createObstacles(terrainType, groundY)];
}
