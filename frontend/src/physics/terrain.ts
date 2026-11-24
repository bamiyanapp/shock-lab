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

/** 角の丸めの、円弧を近似する線分の数 */
const CORNER_SEGMENTS = 6;
/** 段差・台形の上側の角の、丸めの半径（px）の上限 */
const MAX_CORNER_RADIUS_PX = 12;

/**
 * 凸多角形の頂点列のうち、radiiが正の頂点の角を、円弧（2次ベジェ）で丸める（issue #579）。
 * 半径は、隣の辺の長さの半分までに抑える。radiiが0の頂点は、そのまま残す。
 * 地面に接する角は、丸めると、地面との間にすき間ができるため、0にする。
 */
export function roundCorners(points: Matter.Vector[], radii: number[]): Matter.Vector[] {
  const rounded: Matter.Vector[] = [];
  points.forEach((corner, index) => {
    const radius = radii[index] ?? 0;
    if (radius <= 0) {
      rounded.push({ x: corner.x, y: corner.y });
      return;
    }
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const toPrevious = Math.hypot(previous.x - corner.x, previous.y - corner.y);
    const toNext = Math.hypot(next.x - corner.x, next.y - corner.y);
    const cut = Math.min(radius, toPrevious / 2, toNext / 2);
    const start = { x: corner.x + ((previous.x - corner.x) / toPrevious) * cut, y: corner.y + ((previous.y - corner.y) / toPrevious) * cut };
    const end = { x: corner.x + ((next.x - corner.x) / toNext) * cut, y: corner.y + ((next.y - corner.y) / toNext) * cut };
    for (let step = 0; step <= CORNER_SEGMENTS; step += 1) {
      const t = step / CORNER_SEGMENTS;
      const u = 1 - t;
      rounded.push({
        x: u * u * start.x + 2 * u * t * corner.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * corner.y + t * t * end.y,
      });
    }
  });
  return rounded;
}

/**
 * 頂点（ワールド座標）から凸多角形の剛体を作る。Bodies.fromVertices は図形の重心を指定座標へ
 * 置くため、頂点配列自身の重心を指定して、頂点がワールド座標のまま配置されるようにする。
 */
function createPolygon(worldVertices: Matter.Vector[]): Matter.Body {
  const centre = Matter.Vertices.centre(worldVertices);
  return Matter.Bodies.fromVertices(centre.x, centre.y, [worldVertices], OBSTACLE_OPTIONS);
}

/**
 * 地面上面を基準に、中心x・幅・高さの矩形バンプを置く（下端は地面の厚みぶん地中へ延ばす）。
 * 上側の2つの角を丸める。半径は、高さの0.7倍（上限あり）。
 */
function createRectBump(centerX: number, width: number, height: number, groundY: number): Matter.Body {
  const radius = Math.min(height * 0.7, MAX_CORNER_RADIUS_PX);
  const bottomY = groundY + GROUND_THICKNESS_PX;
  const points = [
    { x: centerX - width / 2, y: bottomY },
    { x: centerX - width / 2, y: groundY - height },
    { x: centerX + width / 2, y: groundY - height },
    { x: centerX + width / 2, y: bottomY },
  ];
  return createPolygon(roundCorners(points, [0, radius, radius, 0]));
}

/** 山形の断面を、凸の縦の短冊に分ける数。多いほど、なめらかになる */
const DOME_STRIPS = 24;
/** 隣り合う短冊を、わずかに重ねる幅（px）。描画のつなぎ目に、すき間が出ないようにする */
const DOME_STRIP_OVERLAP_PX = 0.5;

/**
 * 丸い山形のバンプ（スピードバンプ）。断面は、半コサインの曲線で、両端は地面へなめらかにつながり、
 * 頂上は丸い（issue #590）。曲線は凹形のため、凸の細い縦の短冊を並べた複合ボディにする。
 * 物理と描画は、同じ頂点を使う。下端は、地面の厚みぶん地中へ延ばす。
 */
function createDome(centerX: number, width: number, height: number, groundY: number): Matter.Body {
  const bottomY = groundY + GROUND_THICKNESS_PX;
  const left = centerX - width / 2;
  const surfaceY = (x: number) => groundY - (height * (1 + Math.cos((Math.PI * (x - centerX)) / (width / 2)))) / 2;
  const strips: Matter.Vector[][] = [];
  for (let i = 0; i < DOME_STRIPS; i += 1) {
    const x0 = left + (width * i) / DOME_STRIPS - DOME_STRIP_OVERLAP_PX;
    const x1 = left + (width * (i + 1)) / DOME_STRIPS + DOME_STRIP_OVERLAP_PX;
    strips.push([
      { x: x0, y: bottomY },
      { x: x0, y: surfaceY(x0) },
      { x: x1, y: surfaceY(x1) },
      { x: x1, y: bottomY },
    ]);
  }
  // 短冊ごとに、頂点がワールド座標のままの剛体を作り、1つの複合ボディへまとめる。
  return Matter.Body.create({ parts: strips.map((vertices) => createPolygon(vertices)), ...OBSTACLE_OPTIONS });
}

/** 直角三角形の上り斜面。startXから進行方向へ上り、頂点の先は垂直に落ちる。先端（頂点）の角を丸める */
function createRamp(startX: number, run: number, height: number, groundY: number) {
  const radius = Math.min(height * 0.4, MAX_CORNER_RADIUS_PX);
  return createPolygon(
    roundCorners(
      [
        { x: startX, y: groundY },
        { x: startX + run, y: groundY },
        { x: startX + run, y: groundY - height },
      ],
      [0, 0, radius]
    )
  );
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
      return repeatObstacles(1500, 360, (x) => createDome(x, 360, computeBumpHeight(x, 80, 1500), groundY));
    case "washboard":
      return repeatObstacles(100, 40, (x) => createRectBump(x, 40, 4, groundY));
    case "jumpRamp":
      // 中心xを斜面の水平長の中央として扱い、頂点側が進行方向になるよう置く。
      return repeatObstacles(2500, 300, (x) =>
        createRamp(x - 150, 300, computeBumpHeight(x, 90, 2500), groundY)
      );
  }
}

/** 待機中のプレビューで、最初の障害物を置くx（px）。車（x=200）の前方で、画面（幅800）の右寄り */
export const PREVIEW_FIRST_OBSTACLE_X_PX = 540;

/** プレビュー用に、同じ形の障害物を、一定間隔でcount個並べる（最初の位置はPREVIEW_FIRST_OBSTACLE_X_PX） */
function previewRow(
  count: number,
  spacing: number,
  create: (centerX: number) => Matter.Body,
  firstX = PREVIEW_FIRST_OBSTACLE_X_PX
): Matter.Body[] {
  return Array.from({ length: count }, (_, index) => create(firstX + index * spacing));
}

/**
 * 待機中のプレビューに見せる、路面のサンプルの障害物を生成する（issue #551）。実際の地形
 * （createObstacles）と同じ形・寸法で、最大の高さのものを、車のすぐ前方（画面内）に並べる。
 * 物理のワールドには加えず、描画だけに使う。実際の地形は、約25m先から始まるため、
 * 待機中には、路面の違いが見えない。createTerrainの結果は変えない。
 */
export function createPreviewObstacles(terrainType: TerrainType, groundY: number): Matter.Body[] {
  switch (terrainType) {
    case "flat":
      return [];
    case "smallBump":
      return previewRow(2, 320, (x) => createRectBump(x, 200, 6, groundY));
    case "largeBump":
      return previewRow(2, 320, (x) => createRectBump(x, 200, 15, groundY));
    case "hugeSpeedBump":
      return previewRow(1, 0, (x) => createDome(x + 60, 360, 80, groundY));
    case "washboard":
      // 実際と同じ間隔（100px）で、画面の右半分に収まる4本。他より手前から並べる。
      return previewRow(4, 100, (x) => createRectBump(x, 40, 4, groundY), 420);
    case "jumpRamp":
      return previewRow(1, 0, (x) => createRamp(x - 90, 300, 90, groundY));
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
