import { useId } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { PARAMETER_RANGES, TERRAIN_TYPES } from "../store/parameterRanges";
import type { TerrainType } from "../types/vehicle";
import { SliderRow } from "./SliderRow";
import { TerrainIcon } from "./TerrainIcon";

const TERRAIN_LABELS: Record<TerrainType, string> = {
  flat: "平坦路",
  smallBump: "小さい段差",
  largeBump: "大きい段差",
  hugeSpeedBump: "巨大スピードバンプ",
  washboard: "洗濯板（波状路）",
  jumpRamp: "ジャンプ台",
};
const KMH_PER_MS = 3.6;

// 路面（アイコンつきのラジオボタン。issue #539）と試験速度の選択（issue #445）。変更すると走行は未開始に戻る（ストアが担う）。
export function TestConditionsPanel() {
  const testConditions = useSimulationStore((state) => state.testConditions);
  const setTestConditions = useSimulationStore((state) => state.setTestConditions);
  const radioGroupId = useId();

  return (
    <div>
      <h2>試験条件</h2>
      <fieldset className="mb-3">
        <legend className="form-label fs-6">路面</legend>
        <div className="row row-cols-2 g-2">
          {TERRAIN_TYPES.map((terrainType) => (
            <div className="col" key={terrainType}>
              <input
                type="radio"
                className="btn-check"
                name="terrainType"
                id={`${radioGroupId}-${terrainType}`}
                checked={testConditions.terrainType === terrainType}
                onChange={() => setTestConditions({ terrainType })}
              />
              <label
                className="btn btn-outline-secondary w-100 d-flex flex-column align-items-center justify-content-center gap-1 py-2"
                style={{ minHeight: 64 }}
                htmlFor={`${radioGroupId}-${terrainType}`}
              >
                <TerrainIcon terrainType={terrainType} />
                <span className="small">{TERRAIN_LABELS[terrainType]}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
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
