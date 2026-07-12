import { useSimulationStore } from "../store/simulationStore";

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
      {label}: {value}
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

  return (
    <div>
      <h2>車両パラメータ</h2>
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
