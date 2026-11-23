import type Matter from "matter-js";
import { computeVehicleLayout } from "./vehicleLayout";

const BODY_COLOR = "#0f766e";
const BODY_OUTLINE = "#134e4a";
const WINDOW_COLOR = "#e0f2fe";
const ARCH_COLOR = "#0b1220";
const TIRE_COLOR = "#1f2937";
const RIM_COLOR = "#cbd5e1";
const SPOKE_COUNT = 5;

export interface VehicleDrawParams {
  chassis: Matter.Body;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
  /** 重心から前軸までの水平距離（正） */
  frontArmPx: number;
  /** 重心から後軸までの水平距離（負） */
  rearArmPx: number;
  wheelRadiusPx: number;
  offsetX: number;
}

function drawHull(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof computeVehicleLayout>) {
  const { bodyFrontX, bodyRearX, hullTopY, floorY, cabinTopY, cabinFrontX, cabinRearX } = layout;
  ctx.beginPath();
  ctx.moveTo(bodyRearX, floorY);
  ctx.lineTo(bodyRearX, hullTopY);
  ctx.lineTo(cabinRearX, hullTopY);
  ctx.lineTo(cabinRearX + 8, cabinTopY);
  ctx.lineTo(cabinFrontX - 14, cabinTopY);
  ctx.lineTo(cabinFrontX + 6, hullTopY);
  ctx.lineTo(bodyFrontX, hullTopY);
  ctx.lineTo(bodyFrontX, floorY);
  ctx.closePath();
}

function drawBody(ctx: CanvasRenderingContext2D, params: VehicleDrawParams) {
  const { chassis, frontArmPx, rearArmPx, wheelRadiusPx, offsetX } = params;
  const layout = computeVehicleLayout(frontArmPx, rearArmPx, wheelRadiusPx);
  ctx.save();
  // 原点を車体の重心へ置く。物理のバネ取り付け点（重心+arm）と同じ座標系で描くため、絵と物理がずれない。
  ctx.translate(chassis.position.x - offsetX, chassis.position.y);
  ctx.rotate(chassis.angle);

  drawHull(ctx, layout);
  ctx.fillStyle = BODY_COLOR;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = BODY_OUTLINE;
  ctx.stroke();

  // ホイールハウス。頂点が重心の高さ（バネ取り付け位置）になる。車体の形で切り抜いて描く。
  ctx.save();
  drawHull(ctx, layout);
  ctx.clip();
  ctx.fillStyle = ARCH_COLOR;
  for (const archX of [layout.frontArchX, layout.rearArchX]) {
    ctx.beginPath();
    ctx.arc(archX, layout.archCenterY, layout.archRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 窓
  ctx.fillStyle = WINDOW_COLOR;
  ctx.beginPath();
  ctx.moveTo(layout.cabinRearX + 14, layout.hullTopY - 4);
  ctx.lineTo(layout.cabinRearX + 18, layout.cabinTopY + 5);
  ctx.lineTo(layout.cabinFrontX - 16, layout.cabinTopY + 5);
  ctx.lineTo(layout.cabinFrontX - 2, layout.hullTopY - 4);
  ctx.closePath();
  ctx.fill();

  // ヘッドライト・テールライト
  ctx.fillStyle = "#fde047";
  ctx.fillRect(layout.bodyFrontX - 5, layout.hullTopY + 4, 5, 8);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(layout.bodyRearX, layout.hullTopY + 4, 4, 8);
  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, wheel: Matter.Body, radiusPx: number, offsetX: number) {
  ctx.save();
  ctx.translate(wheel.position.x - offsetX, wheel.position.y);
  ctx.rotate(wheel.angle);
  ctx.fillStyle = TIRE_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RIM_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // スポークで、回転が見えるようにする
  ctx.strokeStyle = TIRE_COLOR;
  ctx.lineWidth = Math.max(2, radiusPx * 0.12);
  for (let i = 0; i < SPOKE_COUNT; i += 1) {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radiusPx * 0.6, Math.sin(angle) * radiusPx * 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = TIRE_COLOR;
  ctx.beginPath();
  ctx.arc(0, 0, radiusPx * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 車体・タイヤを、物理ボディの位置と角度から描く。車体は重心、タイヤは各タイヤの物理位置に描くため、
 * 車高・バンプでの車体の沈みが、車体とタイヤの位置関係として見た目に出る（issue #509）。
 * タイヤは車体より手前（横から見た車体の外側）に描く。バネは呼び出し側が、この後に重ねて描く。
 */
export function drawVehicle(ctx: CanvasRenderingContext2D, params: VehicleDrawParams) {
  drawBody(ctx, params);
  drawWheel(ctx, params.rearWheel, params.wheelRadiusPx, params.offsetX);
  drawWheel(ctx, params.frontWheel, params.wheelRadiusPx, params.offsetX);
}
