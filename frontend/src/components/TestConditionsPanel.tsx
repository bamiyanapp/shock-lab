import { useSimulationStore } from "../store/simulationStore";
import { PARAMETER_RANGES, TERRAIN_TYPES } from "../store/parameterRanges";
import type { TerrainType } from "../types/vehicle";
import { SliderRow } from "./SliderRow";

const TERRAIN_LABELS: Record<TerrainType, string> = {
  flat: "平坦路",
  smallBump: "小さい段差",
  largeBump: "大きい段差",
  hugeSpeedBump: "巨大スピードバンプ",
  washboard: "洗濯板（波状路）",
  jumpRamp: "ジャンプ台",
};
const KMH_PER_MS = 3.6;

// 路面と試験速度の選択（issue #445）。変更すると走行は未開始に戻る（ストアが担う）。
export function TestConditionsPanel() {
  const testConditions = useSimulationStore((state) => state.testConditions);
  const setTestConditions = useSimulationStore((state) => state.setTestConditions);

  return (
    <div>
      <h2>試験条件</h2>
      <label className="form-label d-block mb-3">
        路面
        <select
          className="form-select"
          value={testConditions.terrainType}
          onChange={(event) => setTestConditions({ terrainType: event.target.value as TerrainType })}
        >
          {TERRAIN_TYPES.map((terrainType) => (
            <option key={terrainType} value={terrainType}>
              {TERRAIN_LABELS[terrainType]}
            </option>
          ))}
        </select>
      </label>
      <SliderRow
        label="試験速度"
        unit="m/s"
        min={PARAMETER_RANGES.speed.min}
        max={PARAMETER_RANGES.speed.max}
        step={PARAMETER_RANGES.speed.step}
        value={testConditions.speed}
        onChange={(speed) => setTestConditions({ speed })}
      />
      <p className="text-body-secondary small">{(testConditions.speed * KMH_PER_MS).toFixed(0)} km/h</p>
    </div>
  );
}
