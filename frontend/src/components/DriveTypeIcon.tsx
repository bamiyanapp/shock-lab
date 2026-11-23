import { useId } from "react";
import type { DriveType } from "../types/vehicle";
import { DRIVEN_WHEELS } from "./driveTypeIcons";

const WIDTH = 72;
const HEIGHT = 32;
const WHEEL_Y = 23;
const WHEEL_RADIUS = 7;
const REAR_X = 18;
const FRONT_X = 54;
// 駆動輪の色。選択中（濃い背景）でも、未選択（白い背景）でも見分けられる色にする。
const DRIVEN_COLOR = "#f59e0b";

/**
 * 車を真横から見た簡単なイラスト（右向き。キャンバスの車と同じ）。駆動輪のタイヤを色付けし、
 * 色に加えて、太い枠線と斜線の模様でも区別する（色だけに頼らない）。装飾なので読み上げ対象にしない。
 */
export function DriveTypeIcon({ driveType }: { driveType: DriveType }) {
  const patternId = useId();
  const driven = DRIVEN_WHEELS[driveType];

  const wheel = (x: number, isDriven: boolean, key: "front" | "rear") => (
    <g key={key} data-wheel={key} data-driven={isDriven}>
      <circle
        cx={x}
        cy={WHEEL_Y}
        r={WHEEL_RADIUS}
        fill={isDriven ? DRIVEN_COLOR : "currentColor"}
        fillOpacity={isDriven ? 1 : 0.35}
        stroke="currentColor"
        strokeWidth={isDriven ? 2.5 : 1}
      />
      {isDriven ? <circle cx={x} cy={WHEEL_Y} r={WHEEL_RADIUS - 1} fill={`url(#${patternId})`} /> : null}
    </g>
  );

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      data-drive-icon={driveType}
    >
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
      {/* 車体（右向きの簡単なシルエット） */}
      <path
        d="M4 22 L4 15 L16 13 L24 6 L44 6 L54 13 L68 15 L68 22 Z"
        fill="currentColor"
        fillOpacity={0.18}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {wheel(REAR_X, driven.rear, "rear")}
      {wheel(FRONT_X, driven.front, "front")}
    </svg>
  );
}
