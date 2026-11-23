import type { TerrainType } from "../types/vehicle";
import { TERRAIN_ICON_HEIGHT, TERRAIN_ICON_POINTS, TERRAIN_ICON_WIDTH } from "./terrainIcons";

/** 路面の断面の小さなアイコン。装飾なので、読み上げ対象にしない（名前は路面名の文字から取る）。 */
export function TerrainIcon({ terrainType }: { terrainType: TerrainType }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={TERRAIN_ICON_WIDTH}
      height={TERRAIN_ICON_HEIGHT}
      viewBox={`0 0 ${TERRAIN_ICON_WIDTH} ${TERRAIN_ICON_HEIGHT}`}
      data-terrain-icon={terrainType}
    >
      <polygon points={TERRAIN_ICON_POINTS[terrainType]} fill="currentColor" />
    </svg>
  );
}
