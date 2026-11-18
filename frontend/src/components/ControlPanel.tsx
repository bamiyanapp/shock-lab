import { useState } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { computeSuspensionTheory } from "../physics/suspensionTheory";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";
import { PARAMETER_RANGES } from "../store/parameterRanges";
import type { VehicleConfig } from "../types/vehicle";
import ShareButton from "./ShareButton.jsx";

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
  // 入力中の文字列はローカルで保持し、blur・Enterで確定する（途中の「1」「12」で毎回
  // シミュレーションを作り直さないため。空・非数は元の値へ戻し、範囲外は丸める）。
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = draft.trim() === "" ? Number.NaN : Number(draft);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
  };

  return (
    <label className="form-label d-block mb-3">
      <span className="d-flex justify-content-between align-items-center gap-2 mb-1">
        {label}
        <input
          type="number"
          className="form-control form-control-sm w-auto"
          min={min}
          max={max}
          step={step}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
          }}
        />
      </span>
      <input
        type="range"
        className="form-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

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
  const { naturalFrequencyHz, dampingRatio } = computeSuspensionTheory(
    vehicle.suspension.springConstant,
    vehicle.suspension.damperCoefficient,
    vehicle.body.weightKg
  );

  return (
    <div>
      <h2>車両パラメータ</h2>
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
      <p className="text-body-secondary mb-1">
        固有振動数: {naturalFrequencyHz.toFixed(2)} Hz / 減衰比 ζ: {dampingRatio.toFixed(2)}
      </p>
      {/* タッチ端末にはホバーが無くtitle属性を読めないため、補足文として常時表示する（issue #449）。 */}
      <p className="text-body-secondary small">
        ζが1未満: 揺れが残りやすい（ふわふわ）／1超: 動きが硬い（ガチガチ）
      </p>
      <SliderRow
        label="車重(kg)"
        min={PARAMETER_RANGES.weightKg.min}
        max={PARAMETER_RANGES.weightKg.max}
        step={PARAMETER_RANGES.weightKg.step}
        value={vehicle.body.weightKg}
        onChange={(weightKg) => setVehicle({ body: { ...vehicle.body, weightKg } })}
      />
      <SliderRow
        label="バネ定数(N/m)"
        min={PARAMETER_RANGES.springConstant.min}
        max={PARAMETER_RANGES.springConstant.max}
        step={PARAMETER_RANGES.springConstant.step}
        value={vehicle.suspension.springConstant}
        onChange={(springConstant) =>
          setVehicle({ suspension: { ...vehicle.suspension, springConstant } })
        }
      />
      <SliderRow
        label="ダンパー減衰(N・s/m)"
        min={PARAMETER_RANGES.damperCoefficient.min}
        max={PARAMETER_RANGES.damperCoefficient.max}
        step={PARAMETER_RANGES.damperCoefficient.step}
        value={vehicle.suspension.damperCoefficient}
        onChange={(damperCoefficient) =>
          setVehicle({ suspension: { ...vehicle.suspension, damperCoefficient } })
        }
      />
      <SliderRow
        label="車高(m)"
        min={PARAMETER_RANGES.rideHeight.min}
        max={PARAMETER_RANGES.rideHeight.max}
        step={PARAMETER_RANGES.rideHeight.step}
        value={vehicle.suspension.rideHeight}
        onChange={(rideHeight) => setVehicle({ suspension: { ...vehicle.suspension, rideHeight } })}
      />
    </div>
  );
}
