import Matter from "matter-js";
import type { TerrainType } from "../types/vehicle";

/**
 * 路面種類ごとの地形をボディ列として生成する。
 * MVPでは平坦路とシンプルな段差のみを扱い、波状路・ジャンプ台等は今後拡張する。
 */
export function createTerrain(terrainType: TerrainType, groundY: number): Matter.Body[] {
  const groundOptions: Matter.IChamferableBodyDefinition = { isStatic: true, friction: 0.8 };

  if (terrainType === "flat") {
    return [Matter.Bodies.rectangle(5000, groundY + 50, 10000, 100, groundOptions)];
  }

  const bumpHeight = terrainType === "hugeSpeedBump" ? 80 : 30;
  return [
    Matter.Bodies.rectangle(2000, groundY + 50, 4000, 100, groundOptions),
    Matter.Bodies.rectangle(4100, groundY + 50 - bumpHeight / 2, 200, 100 + bumpHeight, groundOptions),
    Matter.Bodies.rectangle(6200, groundY + 50, 4000, 100, groundOptions),
  ];
}
