import Matter from "matter-js";
import type { TerrainType } from "../types/vehicle";

const GROUND_THICKNESS_PX = 100;
const BUMP_WIDTH_PX = 200;
const BUMP_SPACING_PX = 1200;
const FIRST_BUMP_X_PX = 1500;

/** 走行コースの総延長（ワールド座標基準）。scenery（背景の木・家）の配置範囲もこれに合わせる。 */
export const COURSE_LENGTH_PX = 20000;

/**
 * 路面種類ごとの地形をボディ列として生成する。flat以外は単発の段差ではなく、
 * コース全体に一定間隔でバンプを繰り返し配置し、走行中に何度も段差に遭遇するようにする。
 * MVPでは波状路・ジャンプ台等の専用形状は今後拡張する。
 */
export function createTerrain(terrainType: TerrainType, groundY: number): Matter.Body[] {
  const groundOptions: Matter.IChamferableBodyDefinition = {
    isStatic: true,
    friction: 0.8,
    render: { fillStyle: "#52606d" },
  };
  // バンプは背景・地面と混同しないよう、警告色（アンバー）で明確に色分けする。
  const bumpOptions: Matter.IChamferableBodyDefinition = {
    isStatic: true,
    friction: 0.8,
    render: { fillStyle: "#f59e0b" },
  };
  const groundCenterY = groundY + GROUND_THICKNESS_PX / 2;

  if (terrainType === "flat") {
    return [
      Matter.Bodies.rectangle(
        COURSE_LENGTH_PX / 2,
        groundCenterY,
        COURSE_LENGTH_PX,
        GROUND_THICKNESS_PX,
        groundOptions
      ),
    ];
  }

  const bumpHeight = terrainType === "hugeSpeedBump" ? 80 : 30;
  const bodies: Matter.Body[] = [];
  let cursor = 0;

  for (
    let bumpCenter = FIRST_BUMP_X_PX;
    bumpCenter + BUMP_WIDTH_PX / 2 < COURSE_LENGTH_PX;
    bumpCenter += BUMP_SPACING_PX
  ) {
    const segmentWidth = bumpCenter - BUMP_WIDTH_PX / 2 - cursor;
    if (segmentWidth > 0) {
      bodies.push(
        Matter.Bodies.rectangle(
          cursor + segmentWidth / 2,
          groundCenterY,
          segmentWidth,
          GROUND_THICKNESS_PX,
          groundOptions
        )
      );
    }
    bodies.push(
      Matter.Bodies.rectangle(
        bumpCenter,
        groundCenterY - bumpHeight / 2,
        BUMP_WIDTH_PX,
        GROUND_THICKNESS_PX + bumpHeight,
        bumpOptions
      )
    );
    cursor = bumpCenter + BUMP_WIDTH_PX / 2;
  }

  const trailingWidth = COURSE_LENGTH_PX - cursor;
  if (trailingWidth > 0) {
    bodies.push(
      Matter.Bodies.rectangle(
        cursor + trailingWidth / 2,
        groundCenterY,
        trailingWidth,
        GROUND_THICKNESS_PX,
        groundOptions
      )
    );
  }

  return bodies;
}
