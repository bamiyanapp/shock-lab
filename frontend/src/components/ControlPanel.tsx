import { useSimulationStore } from "../store/simulationStore";
import { computeSuspensionTheory } from "../physics/suspensionTheory";
import { computeStaticState } from "../physics/vehicleGeometry";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";
import { DRIVE_TYPES, PARAMETER_RANGES } from "../store/parameterRanges";
import type { DriveType, VehicleConfig } from "../types/vehicle";
import ShareButton from "./ShareButton.jsx";
import { SliderRow } from "./SliderRow";

const CUSTOM_PRESET_ID = "custom";

const DRIVE_TYPE_LABELS: Record<DriveType, string> = {
  awd: "四駆（4WD）",
  ff: "前輪駆動（FF）",
  fr: "後輪駆動（FR）",
};

// 現在の車両設定がいずれかのプリセットと全項目一致するときはそのIDを、一致しなければ
// 「カスタム」を返す（スライダー変更後・共有URL読み込み後も表示が実態と一致するように）。
function findMatchingPresetId(vehicle: VehicleConfig): string {
  const serialized = JSON.stringify(vehicle);
  const match = VEHICLE_PRESETS.find((preset) => JSON.stringify(preset.config) === serialized);
  return match?.id ?? CUSTOM_PRESET_ID;
}

// メートルをセンチへ。小数1桁で、誤差を見せない。
function formatCm(meters: number): string {
  return (meters * 100).toFixed(1);
}

export function ControlPanel() {
  const vehicle = useSimulationStore((state) => state.vehicle);
  const setVehicle = useSimulationStore((state) => state.setVehicle);
  const testConditions = useSimulationStore((state) => state.testConditions);
  const staticState = computeStaticState(vehicle);
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
      <label className="form-label d-block mb-3">
        駆動方式
        <select
          className="form-select"
          value={vehicle.body.driveType}
          onChange={(event) => {
            const driveType = DRIVE_TYPES.find((candidate) => candidate === event.target.value);
            if (driveType) setVehicle({ body: { ...vehicle.body, driveType } });
          }}
        >
          {DRIVE_TYPES.map((driveType) => (
            <option key={driveType} value={driveType}>
              {DRIVE_TYPE_LABELS[driveType]}
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
      <SliderRow
        label="バネ定数"
        unit="kN/m"
        displayScale={0.001}
        min={PARAMETER_RANGES.springConstant.min}
        max={PARAMETER_RANGES.springConstant.max}
        step={PARAMETER_RANGES.springConstant.step}
        value={vehicle.suspension.springConstant}
        onChange={(springConstant) =>
          setVehicle({ suspension: { ...vehicle.suspension, springConstant } })
        }
      />
      <SliderRow
        label="ダンパー減衰"
        unit="kN・s/m"
        displayScale={0.001}
        min={PARAMETER_RANGES.damperCoefficient.min}
        max={PARAMETER_RANGES.damperCoefficient.max}
        step={PARAMETER_RANGES.damperCoefficient.step}
        value={vehicle.suspension.damperCoefficient}
        onChange={(damperCoefficient) =>
          setVehicle({ suspension: { ...vehicle.suspension, damperCoefficient } })
        }
      />
      <SliderRow
        label="ストローク量"
        unit="cm"
        displayScale={100}
        min={PARAMETER_RANGES.strokeLength.min}
        max={PARAMETER_RANGES.strokeLength.max}
        step={PARAMETER_RANGES.strokeLength.step}
        value={vehicle.suspension.strokeLength}
        onChange={(strokeLength) => setVehicle({ suspension: { ...vehicle.suspension, strokeLength } })}
      />
      <SliderRow
        label="バネ取り付け位置"
        unit="cm"
        displayScale={100}
        min={PARAMETER_RANGES.mountHeight.min}
        max={PARAMETER_RANGES.mountHeight.max}
        step={PARAMETER_RANGES.mountHeight.step}
        value={vehicle.suspension.mountHeight}
        onChange={(mountHeight) => setVehicle({ suspension: { ...vehicle.suspension, mountHeight } })}
      />
      {/* 実際の車高は、取り付け位置・バネ定数・ストローク量・車重から決まる値で、読み取り専用（issue #557）。 */}
      <p className="text-body-secondary mb-1" data-testid="static-state">
        実際の車高: {formatCm(staticState.rideHeightM)} cm（静止時のたわみ: 前{formatCm(staticState.sagFrontM)} cm・後
        {formatCm(staticState.sagRearM)} cm）
      </p>
      {staticState.isBottomedOutAtStart && (
        <p className="text-danger" role="alert">
          バネがたわみきっていて、走れません。バネ定数を上げるか、車重を下げるか、ストローク量を増やしてください。
        </p>
      )}
    </div>
  );
}
