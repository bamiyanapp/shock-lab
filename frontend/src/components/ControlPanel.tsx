import { useId } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";
import { DRIVE_TYPES, PARAMETER_RANGES } from "../store/parameterRanges";
import type { VehicleConfig } from "../types/vehicle";
import ShareButton from "./ShareButton.jsx";
import { SliderRow } from "./SliderRow";
import { DriveTypeIcon } from "./DriveTypeIcon";
import { DRIVE_TYPE_LABELS } from "./driveTypeIcons";

const CUSTOM_PRESET_ID = "custom";

// 現在の車両設定がいずれかのプリセットと全項目一致するときはそのIDを、一致しなければ
// 「カスタム」を返す（スライダー変更後・共有URL読み込み後も表示が実態と一致するように）。
function findMatchingPresetId(vehicle: VehicleConfig): string {
  const serialized = JSON.stringify(vehicle);
  const match = VEHICLE_PRESETS.find((preset) => JSON.stringify(preset.config) === serialized);
  return match?.id ?? CUSTOM_PRESET_ID;
}

export function ControlPanel() {
  const vehicle = useSimulationStore((state) => state.vehicle);
  const setVehicle = useSimulationStore((state) => state.setVehicle);
  const testConditions = useSimulationStore((state) => state.testConditions);
  const driveRadioId = useId();

  return (
    <div>
      <div className="mb-3">
        <ShareButton
          label="セッティングを共有"
          className="btn btn-outline-secondary"
          getUrl={() => buildShareUrl(vehicle, testConditions)}
        />
      </div>
      <label className="form-label d-block mb-3">
        プリセット
        <select
          className="form-select"
          value={findMatchingPresetId(vehicle)}
          onChange={(event) => {
            const preset = VEHICLE_PRESETS.find((candidate) => candidate.id === event.target.value);
            if (preset) setVehicle(preset.config);
          }}
        >
          <option value={CUSTOM_PRESET_ID} disabled>
            カスタム
          </option>
          {VEHICLE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mb-3">
        <legend className="form-label fs-6">駆動方式</legend>
        <div className="row row-cols-3 g-2">
          {DRIVE_TYPES.map((driveType) => (
            <div className="col" key={driveType}>
              <input
                type="radio"
                className="btn-check"
                name="driveType"
                id={`${driveRadioId}-${driveType}`}
                checked={vehicle.body.driveType === driveType}
                onChange={() => setVehicle({ body: { ...vehicle.body, driveType } })}
              />
              <label
                className="btn btn-outline-secondary w-100 d-flex flex-column align-items-center justify-content-center gap-1 py-2 px-1"
                style={{ minHeight: 64 }}
                htmlFor={`${driveRadioId}-${driveType}`}
              >
                <DriveTypeIcon driveType={driveType} />
                <span className="small">{DRIVE_TYPE_LABELS[driveType]}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <SliderRow
        label="車重"
        unit="kg"
        min={PARAMETER_RANGES.weightKg.min}
        max={PARAMETER_RANGES.weightKg.max}
        step={PARAMETER_RANGES.weightKg.step}
        value={vehicle.body.weightKg}
        onChange={(weightKg) => setVehicle({ body: { ...vehicle.body, weightKg } })}
      />
      <SliderRow
        label="ホイールベース"
        unit="m"
        min={PARAMETER_RANGES.wheelbase.min}
        max={PARAMETER_RANGES.wheelbase.max}
        step={PARAMETER_RANGES.wheelbase.step}
        value={vehicle.body.wheelbase}
        onChange={(wheelbase) => setVehicle({ body: { ...vehicle.body, wheelbase } })}
      />
    </div>
  );
}
