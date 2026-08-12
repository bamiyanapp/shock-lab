export type SceneryKind = "tree" | "house";

export interface SceneryItem {
  worldX: number;
  kind: SceneryKind;
}

const SPACING_PX = 260;
const HOUSE_EVERY_N = 4;

/**
 * 走行コース沿いに木・家をワールド座標上へ等間隔に配置する。カメラが車体に追従することで
 * これらが後方へ流れて見え、走行している実感を得やすくする（Matter.jsのBodyではなく、
 * 描画専用の純粋なデータとして扱う）。
 */
export function createScenery(courseLengthPx: number, startX = 300): SceneryItem[] {
  const items: SceneryItem[] = [];
  let index = 0;
  for (let x = startX; x < courseLengthPx; x += SPACING_PX) {
    items.push({ worldX: x, kind: index % HOUSE_EVERY_N === 0 ? "house" : "tree" });
    index += 1;
  }
  return items;
}

export type ParallaxKind = "mountain" | "cloud";

export interface ParallaxItem {
  worldX: number;
  kind: ParallaxKind;
}

export interface ParallaxLayer {
  /** カメラ移動量に対して背景をどれだけ動かすかの比率（0〜1）。小さいほど遠くにあるように見える */
  speedFactor: number;
  items: ParallaxItem[];
}

const MOUNTAIN_SPACING_PX = 900;
const CLOUD_SPACING_PX = 700;

function createParallaxItems(
  courseLengthPx: number,
  spacingPx: number,
  startX: number,
  kind: ParallaxKind
): ParallaxItem[] {
  const items: ParallaxItem[] = [];
  for (let x = startX; x < courseLengthPx; x += spacingPx) {
    items.push({ worldX: x, kind });
  }
  return items;
}

/**
 * 遠景（山並み・雲）を、通常のscenery（木・家）よりゆっくり流れる複数レイヤーとして生成する。
 * 描画側でworldXにspeedFactorを乗じたぶんだけカメラ移動を反映させることで、
 * 手前のsceneryより奥にあるように見える視差スクロールを実現する。
 */
export function createParallaxLayers(courseLengthPx: number): ParallaxLayer[] {
  return [
    { speedFactor: 0.2, items: createParallaxItems(courseLengthPx, MOUNTAIN_SPACING_PX, 0, "mountain") },
    { speedFactor: 0.5, items: createParallaxItems(courseLengthPx, CLOUD_SPACING_PX, 150, "cloud") },
  ];
}
