import { useState } from "react";

export interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

export function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
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
