import { useState } from "react";

export interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** 入力欄の右に表示する単位 */
  unit?: string;
  /**
   * 表示値 = 内部値 × displayScale。内部の単位（N/m・m等）を変えずに、画面だけkN/m・cm等で
   * 見せるために使う。min・max・step・valueは内部の単位で渡す。
   */
  displayScale?: number;
}

// 倍率をかけた際の浮動小数点の誤差（0.35×100=35.00000000000001等）を、表示・保存値に残さない。
function roundTo6(value: number): number {
  return Number(value.toFixed(6));
}

export function SliderRow({ label, min, max, step, value, onChange, unit, displayScale = 1 }: SliderRowProps) {
  const toDisplay = (internal: number) => roundTo6(internal * displayScale);
  const toInternal = (shown: number) => roundTo6(shown / displayScale);
  const shownMin = toDisplay(min);
  const shownMax = toDisplay(max);
  const shownStep = toDisplay(step);
  // 入力中の文字列はローカルで保持し、blur・Enterで確定する（途中の「1」「12」で毎回
  // シミュレーションを作り直さないため。空・非数は元の値へ戻し、範囲外は丸める）。
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = draft.trim() === "" ? Number.NaN : Number(draft);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, toInternal(parsed))));
  };

  return (
    <label className="form-label d-block mb-3">
      <span className="d-flex justify-content-between align-items-center gap-2 mb-1">
        {label}
        <span className="d-flex align-items-center gap-1">
          <input
            type="number"
            className="form-control form-control-sm w-auto"
            min={shownMin}
            max={shownMax}
            step={shownStep}
            value={draft ?? toDisplay(value)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitDraft();
            }}
          />
          {unit ? <span className="text-body-secondary small text-nowrap">{unit}</span> : null}
        </span>
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
