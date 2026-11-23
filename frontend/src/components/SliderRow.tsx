export interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** 数値の右に表示する単位 */
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

/**
 * スライダーだけで値を変える行。数値は表示のみで、入力欄は持たない（issue #536。スマホで
 * 数値入力のキーボードが画面を押し上げるため）。スライダーは範囲内・刻み単位の値しか出さないので、
 * 範囲外・空・非数の丸め処理は要らない。
 */
export function SliderRow({ label, min, max, step, value, onChange, unit, displayScale = 1 }: SliderRowProps) {
  const shownValue = roundTo6(value * displayScale);
  const valueText = unit ? `${shownValue} ${unit}` : String(shownValue);

  return (
    <label className="form-label d-block mb-3">
      <span className="d-flex justify-content-between align-items-center gap-2 mb-1">
        {label}
        <output className="text-body-secondary text-nowrap">{valueText}</output>
      </span>
      <input
        type="range"
        className="form-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onChange(roundTo6(Number(event.target.value)))}
      />
    </label>
  );
}
