import type { CSSProperties } from "react";
import Matter from "matter-js";
import type { SuspensionAxle } from "../physics/suspension";
import type { DustParticle } from "../physics/impactEffects";
import type { ParallaxLayer, SceneryItem } from "../physics/scenery";

// 試験開始中は画面全体を覆うフルスクリーン表示にする（issue #231）。iOS Safariは
// 非video要素のFullscreen API（Element.requestFullscreen）に対応していないことが
// あり、ブラウザ機能に依存すると主要な検証端末（iPhone）で無反応になりかねないため、
// ブラウザAPIを使わずCSS（position: fixedで画面全体を覆う）のみで実現している。
// スタイル（position・サイズ・背景色・中央寄せ）はBootstrapのユーティリティクラスではなく
// インラインstyleで直接指定する。Bootstrapのクラス名に依存せず、スタイルの読み込み順や
// 将来のテーマ変更の影響を受けずに本機能自体（画面を覆う・canvasを中央に表示する）が
// 成立するようにするため。
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

/**
 * 地面・障害物を、物理ボディの頂点そのままに描く。Matter.jsの既定描画はafterRenderで描く背景
 * （山・雲・木・家）に上書きされ、バンプが背景の裏に隠れて見えたため、自前で背景の後に描く。
 * 物理と同じ頂点を使うので、見た目と当たり判定がずれない。
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  terrainBodies: Matter.Body[],
  offsetX: number,
  canvasWidth: number,
  groundScreenY?: number
) {
  for (const body of terrainBodies) {
    if (body.bounds.max.x - offsetX < 0 || body.bounds.min.x - offsetX > canvasWidth) continue;
    ctx.fillStyle = body.render.fillStyle ?? "#52606d";
    // 障害物（地面より上へ出ているボディ）は、物理のため地面の下へも延びている。その部分を描くと、
    // 地面を横切る縞に見えるため、地面の高さで切り取る。地面自身は、切り取らない。
    const isObstacle = groundScreenY !== undefined && body.bounds.min.y < groundScreenY - 1;
    if (isObstacle) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvasWidth, groundScreenY);
      ctx.clip();
    }
    // 凹形状は複数のパーツに分かれる。先頭は全体を表すため、パーツがあるときはそれ以外を描く。
    const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
    for (const part of parts) {
      const [first, ...rest] = part.vertices;
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first.x - offsetX, first.y);
      for (const vertex of rest) ctx.lineTo(vertex.x - offsetX, vertex.y);
      ctx.closePath();
      ctx.fill();
    }
    if (isObstacle) ctx.restore();
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

export function drawSuspensionSprings(
  ctx: CanvasRenderingContext2D,
  frontSuspension: SuspensionAxle,
  rearSuspension: SuspensionAxle,
  offsetX: number
) {
  for (const axle of [frontSuspension, rearSuspension]) {
    const { top, bottom } = axle.getSpringEnds();
    drawSuspensionSpring(ctx, top.x - offsetX, top.y, bottom.x - offsetX, bottom.y);
  }
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
