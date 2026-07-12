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
