import { useSimulationStore } from "../store/simulationStore";
import { computeSuspensionTheory } from "../physics/suspensionTheory";
import { computeStaticState } from "../physics/vehicleGeometry";
import { PARAMETER_RANGES } from "../store/parameterRanges";
import { SliderRow } from "./SliderRow";

// メートルをセンチへ。小数1桁で、誤差を見せない。
function formatCm(meters: number): string {
  return (meters * 100).toFixed(1);
}

/** サスペンション設定のタブ。バネ・ダンパー・ストローク・取り付け位置と、そこから決まる車高を扱う。 */
export function SuspensionPanel() {
  const vehicle = useSimulationStore((state) => state.vehicle);
  const setVehicle = useSimulationStore((state) => state.setVehicle);
  const staticState = computeStaticState(vehicle);
  const { naturalFrequencyHz, dampingRatio } = computeSuspensionTheory(
    vehicle.suspension.springConstant,
    vehicle.suspension.damperCoefficient,
    vehicle.body.weightKg
  );

  return (
    <div>
      <p className="text-body-secondary mb-1">
        固有振動数: {naturalFrequencyHz.toFixed(2)} Hz / 減衰比 ζ: {dampingRatio.toFixed(2)}
      </p>
      {/* タッチ端末にはホバーが無くtitle属性を読めないため、補足文として常時表示する（issue #449）。 */}
      <p className="text-body-secondary small">
        ζが1未満: 揺れが残りやすい（ふわふわ）／1超: 動きが硬い（ガチガチ）
      </p>
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
