import { useSimulationStore } from "../store/simulationStore";
import { computeSuspensionTheory } from "../physics/suspensionTheory";
import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import { buildShareUrl } from "../store/urlConfig";
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
  return (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {label}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (!Number.isNaN(nextValue)) onChange(nextValue);
          }}
          style={{ width: 90 }}
        />
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ display: "block", width: "100%" }}
      />
    </label>
  );
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
      <div style={{ marginBottom: 8 }}>
        <ShareButton
          label="セッティングを共有"
          getUrl={() => buildShareUrl(vehicle, testConditions)}
        />
      </div>
      <label style={{ display: "block", marginBottom: 8 }}>
        プリセット
        <select
          defaultValue=""
          onChange={(event) => {
            const preset = VEHICLE_PRESETS.find((candidate) => candidate.id === event.target.value);
            if (preset) setVehicle(preset.config);
          }}
          style={{ display: "block", width: "100%" }}
        >
          <option value="" disabled>
            プリセットを選択
          </option>
          {VEHICLE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <p
        title="ζ<1: アンダーダンピング（ふわふわ、振動が続きやすい） / ζ>1: オーバーダンピング（ガチガチ、動きが硬い）"
        style={{ color: "#94a3b8" }}
      >
        固有振動数: {naturalFrequencyHz.toFixed(2)} Hz / 減衰比 ζ: {dampingRatio.toFixed(2)}
      </p>
      <SliderRow
        label="車重(kg)"
        min={500}
        max={30000}
        step={50}
        value={vehicle.body.weightKg}
        onChange={(weightKg) => setVehicle({ body: { ...vehicle.body, weightKg } })}
      />
      <SliderRow
        label="バネ定数(N/m)"
        min={5000}
        max={200000}
        step={1000}
        value={vehicle.suspension.springConstant}
        onChange={(springConstant) =>
          setVehicle({ suspension: { ...vehicle.suspension, springConstant } })
        }
      />
      <SliderRow
        label="ダンパー減衰(N・s/m)"
        min={100}
        max={20000}
        step={100}
        value={vehicle.suspension.damperCoefficient}
        onChange={(damperCoefficient) =>
          setVehicle({ suspension: { ...vehicle.suspension, damperCoefficient } })
        }
      />
      <SliderRow
        label="車高(m)"
        min={0.1}
        max={1}
        step={0.01}
        value={vehicle.suspension.rideHeight}
        onChange={(rideHeight) => setVehicle({ suspension: { ...vehicle.suspension, rideHeight } })}
      />
    </div>
  );
}
