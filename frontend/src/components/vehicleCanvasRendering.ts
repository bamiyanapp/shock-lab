import type { CSSProperties } from "react";
import Matter from "matter-js";
import type { DustParticle } from "../physics/impactEffects";
import type { ParallaxLayer, SceneryItem } from "../physics/scenery";

// 試験開始中は画面全体を覆うフルスクリーン表示にする（issue #231）。iOS Safariは
// 非video要素のFullscreen API（Element.requestFullscreen）に対応していないことが
// あり、ブラウザ機能に依存すると主要な検証端末（iPhone）で無反応になりかねないため、
// ブラウザAPIを使わずCSS（position: fixedで画面全体を覆う）のみで実現している。
// スタイル（position・サイズ・背景色・中央寄せ）はBootstrapのユーティリティクラスではなく
// インラインstyleで直接指定する。Bootstrap本体はCDN読み込みのため、読み込みに失敗・遅延
// した環境でも本機能自体（画面を覆う・canvasを中央に表示する）が成立するようにするため。
export function getFullscreenWrapperStyle(isRunning: boolean): CSSProperties | undefined {
  if (!isRunning) return undefined;
  return {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 1090,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  };
}

// アセット画像（frontend/src/assets/vehicle-sprite.png）は、タイヤの回転角が少しずつ
// 異なる12フレームを縦に並べたスプライトシート。ホイールアニメーション用に切り出して使う。
const VEHICLE_SPRITE_FRAME_COUNT = 12;
const VEHICLE_SPRITE_FRAME_WIDTH = 600;
const VEHICLE_SPRITE_FRAME_HEIGHT = 404;
const VEHICLE_SPRITE_ASPECT_RATIO = VEHICLE_SPRITE_FRAME_HEIGHT / VEHICLE_SPRITE_FRAME_WIDTH;
const STEPS_PER_SECOND = 60;
// 1秒間に何フレーム進めるか（12フレームで1周＝1秒サイクルのホイールアニメーション）。
const VEHICLE_SPRITE_FPS = 12;
const VEHICLE_SPRITE_STEPS_PER_FRAME = STEPS_PER_SECOND / VEHICLE_SPRITE_FPS;
// 画像下部のタイヤ接地位置が画像高さの何割の位置にあるか（目視調整値）。
const VEHICLE_IMAGE_WHEEL_ANCHOR_RATIO = 0.48;

export function drawTree(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
  ctx.fillStyle = "#6b4a2f";
  ctx.fillRect(x - 4, groundScreenY - 36, 8, 36);
  ctx.fillStyle = "#2f7a42";
  ctx.beginPath();
  ctx.moveTo(x, groundScreenY - 88);
  ctx.lineTo(x - 28, groundScreenY - 36);
  ctx.lineTo(x + 28, groundScreenY - 36);
  ctx.closePath();
  ctx.fill();
}

export function drawMountain(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(x, groundScreenY - 150);
  ctx.lineTo(x - 110, groundScreenY);
  ctx.lineTo(x + 110, groundScreenY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.moveTo(x - 55, groundScreenY - 80);
  ctx.lineTo(x - 130, groundScreenY);
  ctx.lineTo(x + 10, groundScreenY);
  ctx.closePath();
  ctx.fill();
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number) {
  const y = 60;
  ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
  ctx.beginPath();
  ctx.ellipse(x, y, 34, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 24, y + 4, 22, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 24, y + 4, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDustParticle(ctx: CanvasRenderingContext2D, particle: DustParticle, screenX: number) {
  const opacity = particle.life / particle.maxLife;
  ctx.fillStyle = `rgba(180, 150, 110, ${(opacity * 0.6).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(screenX, particle.worldY, 2 + (1 - opacity) * 3, 0, Math.PI * 2);
  ctx.fill();
}

// サスペンションのコイルバネを、実際のconstraintのアンカー位置（車体側）とタイヤ中心を
// 結ぶ形で描画する。静止画スプライトへバネを描き込むと、バネの実際の伸縮・車体とタイヤの
// 相対位置とずれて見える問題（issue #44項目3）があったため、実際の物理状態から毎フレーム
// 座標を算出することで、見た目と実際のサスペンション挙動を常に一致させる。
export function drawSuspensionSpring(
  ctx: CanvasRenderingContext2D,
  topX: number,
  topY: number,
  bottomX: number,
  bottomY: number
) {
  const dx = bottomX - topX;
  const dy = bottomY - topY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const unitX = dx / length;
  const unitY = dy / length;
  // 伸縮方向に垂直な単位ベクトル（コイルの振れ幅方向）。
  const perpX = -unitY;
  const perpY = unitX;
  const COIL_COUNT = 6;
  const COIL_WIDTH_PX = 7;

  ctx.save();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  for (let i = 1; i < COIL_COUNT; i++) {
    const t = i / COIL_COUNT;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.lineTo(topX + unitX * length * t + perpX * COIL_WIDTH_PX * side, topY + unitY * length * t + perpY * COIL_WIDTH_PX * side);
  }
  ctx.lineTo(bottomX, bottomY);
  ctx.stroke();

  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(topX, topY, 3, 0, Math.PI * 2);
  ctx.arc(bottomX, bottomY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGoalLine(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
  ctx.fillStyle = "#f0fdfa";
  ctx.fillRect(x - 3, groundScreenY - 160, 6, 160);
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.moveTo(x + 3, groundScreenY - 160);
  ctx.lineTo(x + 40, groundScreenY - 145);
  ctx.lineTo(x + 3, groundScreenY - 130);
  ctx.closePath();
  ctx.fill();
}

export function drawHouse(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
  ctx.fillStyle = "#c98a5c";
  ctx.fillRect(x - 26, groundScreenY - 42, 52, 42);
  ctx.fillStyle = "#8a4b32";
  ctx.beginPath();
  ctx.moveTo(x - 32, groundScreenY - 42);
  ctx.lineTo(x, groundScreenY - 74);
  ctx.lineTo(x + 32, groundScreenY - 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3d3d3d";
  ctx.fillRect(x - 8, groundScreenY - 26, 16, 26);
}

function drawParallaxItem(ctx: CanvasRenderingContext2D, kind: "mountain" | "cloud", screenX: number, groundScreenY: number) {
  if (kind === "mountain") {
    drawMountain(ctx, screenX, groundScreenY);
  } else {
    drawCloud(ctx, screenX);
  }
}

function drawSceneryItem(ctx: CanvasRenderingContext2D, kind: "tree" | "house", screenX: number, groundScreenY: number) {
  if (kind === "tree") {
    drawTree(ctx, screenX, groundScreenY);
  } else {
    drawHouse(ctx, screenX, groundScreenY);
  }
}

// 遠景（山並み・雲）はカメラ移動量にspeedFactorを乗じた分だけ動かし、手前のscenery（木・家）
// より遅く流れて見えるようにする（視差スクロール）。手前のsceneryより先に描画し、背後に置く。
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  parallaxLayers: ParallaxLayer[],
  scenery: SceneryItem[],
  offsetX: number,
  canvasWidth: number,
  groundScreenY: number
) {
  for (const layer of parallaxLayers) {
    for (const item of layer.items) {
      const screenX = item.worldX - offsetX * layer.speedFactor;
      if (screenX < -140 || screenX > canvasWidth + 140) continue;
      drawParallaxItem(ctx, item.kind, screenX, groundScreenY);
    }
  }
  for (const item of scenery) {
    const screenX = item.worldX - offsetX;
    if (screenX < -60 || screenX > canvasWidth + 60) continue;
    drawSceneryItem(ctx, item.kind, screenX, groundScreenY);
  }
}

export function drawDustParticles(
  ctx: CanvasRenderingContext2D,
  dustParticles: DustParticle[],
  offsetX: number,
  canvasWidth: number
) {
  for (const particle of dustParticles) {
    const screenX = particle.worldX - offsetX;
    if (screenX < -20 || screenX > canvasWidth + 20) continue;
    drawDustParticle(ctx, particle, screenX);
  }
}

interface VehicleSpriteParams {
  sprite: HTMLImageElement;
  frontWheel: Matter.Body;
  rearWheel: Matter.Body;
  chassis: Matter.Body;
  wheelbasePx: number;
  wheelRadiusPx: number;
  animationTickCount: number;
  offsetX: number;
}

export function drawVehicleSprite(ctx: CanvasRenderingContext2D, params: VehicleSpriteParams) {
  const { sprite, frontWheel, rearWheel, chassis, wheelbasePx, wheelRadiusPx, animationTickCount, offsetX } = params;
  if (!sprite.complete || sprite.naturalWidth <= 0) return;

  const targetWidthPx = wheelbasePx + wheelRadiusPx * 2.8;
  const targetHeightPx = targetWidthPx * VEHICLE_SPRITE_ASPECT_RATIO;
  const wheelCenterY = (frontWheel.position.y + rearWheel.position.y) / 2;
  const frameIndex = Math.floor(animationTickCount / VEHICLE_SPRITE_STEPS_PER_FRAME) % VEHICLE_SPRITE_FRAME_COUNT;

  ctx.save();
  ctx.translate(chassis.position.x - offsetX, wheelCenterY);
  ctx.rotate(chassis.angle);
  // 画像は左向き（フロントが左）のため、右方向へ進む車体に合わせて左右反転する。
  ctx.scale(-1, 1);
  ctx.drawImage(
    sprite,
    0,
    frameIndex * VEHICLE_SPRITE_FRAME_HEIGHT,
    VEHICLE_SPRITE_FRAME_WIDTH,
    VEHICLE_SPRITE_FRAME_HEIGHT,
    -targetWidthPx / 2,
    -targetHeightPx * VEHICLE_IMAGE_WHEEL_ANCHOR_RATIO,
    targetWidthPx,
    targetHeightPx
  );
  ctx.restore();
}

export function drawSuspensionSprings(
  ctx: CanvasRenderingContext2D,
  frontSuspension: Matter.Constraint,
  rearSuspension: Matter.Constraint,
  offsetX: number
) {
  const frontSpringTop = Matter.Constraint.pointAWorld(frontSuspension);
  const frontSpringBottom = Matter.Constraint.pointBWorld(frontSuspension);
  const rearSpringTop = Matter.Constraint.pointAWorld(rearSuspension);
  const rearSpringBottom = Matter.Constraint.pointBWorld(rearSuspension);
  drawSuspensionSpring(ctx, frontSpringTop.x - offsetX, frontSpringTop.y, frontSpringBottom.x - offsetX, frontSpringBottom.y);
  drawSuspensionSpring(ctx, rearSpringTop.x - offsetX, rearSpringTop.y, rearSpringBottom.x - offsetX, rearSpringBottom.y);
}

export function drawStatusOverlays(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  isBottomedOut: boolean,
  hasReachedGoal: boolean
) {
  // 底付き（ストローク使い切り）中は画面全体を赤くフラッシュさせ、警告として体感的に伝える。
  if (isBottomedOut) {
    ctx.save();
    ctx.fillStyle = "rgba(220, 38, 38, 0.35)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }

  if (hasReachedGoal) {
    ctx.save();
    ctx.fillStyle = "rgba(15, 118, 110, 0.55)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#f0fdfa";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ゴール！", canvasWidth / 2, canvasHeight / 2);
    ctx.restore();
  }
}
