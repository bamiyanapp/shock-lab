import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createWorld } from "../physics/world";
import { createTerrain, COURSE_LENGTH_PX, GOAL_LINE_X_PX } from "../physics/terrain";
import { createVehicleBodies } from "../physics/vehicle";
import { createSuspensionConstraint } from "../physics/suspension";
import { computeMetrics } from "../physics/metrics";
import { shouldApplyDrivingForce } from "../physics/driveControl";
import { computeAirDragDeceleration } from "../physics/resistance";
import { createScenery, createParallaxLayers } from "../physics/scenery";
import { spawnDustBurst, advanceDustParticles, type DustParticle } from "../physics/impactEffects";
import { computeResultRank } from "../physics/resultRank";
import { useSimulationStore } from "../store/simulationStore";
import { shockSound, successSound } from "../audio/soundEffects";
import vehicleSpriteUrl from "../assets/vehicle-sprite.png";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 300;
const STEPS_PER_SECOND = 60;
const PIXELS_PER_METER = 60;
// この値を超える上下Gを検知するとカメラを微振動させる（衝撃の体感フィードバック）。
const IMPACT_SHAKE_THRESHOLD_G = 1.5;
const SHAKE_AMPLITUDE_PX = 4;
// 着地（非接地→接地）1回あたりに発生させる砂埃パーティクル数。
const LANDING_DUST_PARTICLE_COUNT = 8;
// 走行中に接地しているタイヤから、tickごとにこの確率で軽い砂埃を1粒発生させる。
const ROLLING_DUST_SPAWN_PROBABILITY = 0.15;

// アセット画像（frontend/src/assets/vehicle-sprite.png）は、タイヤの回転角が少しずつ
// 異なる12フレームを縦に並べたスプライトシート。ホイールアニメーション用に切り出して使う。
const VEHICLE_SPRITE_FRAME_COUNT = 12;
const VEHICLE_SPRITE_FRAME_WIDTH = 600;
const VEHICLE_SPRITE_FRAME_HEIGHT = 404;
const VEHICLE_SPRITE_ASPECT_RATIO = VEHICLE_SPRITE_FRAME_HEIGHT / VEHICLE_SPRITE_FRAME_WIDTH;
// 1秒間に何フレーム進めるか（12フレームで1周＝1秒サイクルのホイールアニメーション）。
const VEHICLE_SPRITE_FPS = 12;
const VEHICLE_SPRITE_STEPS_PER_FRAME = STEPS_PER_SECOND / VEHICLE_SPRITE_FPS;
// 画像下部のタイヤ接地位置が画像高さの何割の位置にあるか（目視調整値）。
const VEHICLE_IMAGE_WHEEL_ANCHOR_RATIO = 0.48;

const vehicleSprite = new Image();
vehicleSprite.src = vehicleSpriteUrl;

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
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

function drawMountain(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
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

function drawCloud(ctx: CanvasRenderingContext2D, x: number) {
  const y = 60;
  ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
  ctx.beginPath();
  ctx.ellipse(x, y, 34, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 24, y + 4, 22, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 24, y + 4, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDustParticle(ctx: CanvasRenderingContext2D, particle: DustParticle, screenX: number) {
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
function drawSuspensionSpring(
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

function drawGoalLine(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
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

function drawHouse(ctx: CanvasRenderingContext2D, x: number, groundScreenY: number) {
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

export function VehicleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vehicle = useSimulationStore((state) => state.vehicle);
  const terrainType = useSimulationStore((state) => state.testConditions.terrainType);
  const isRunning = useSimulationStore((state) => state.isRunning);
  const runToken = useSimulationStore((state) => state.runToken);

  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = createWorld();
    engineRef.current = engine;
    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine,
      options: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, wireframes: false, background: "#0f172a" },
    });

    const terrainBodies = createTerrain(terrainType, GROUND_Y);
    const scenery = createScenery(COURSE_LENGTH_PX);
    const parallaxLayers = createParallaxLayers(COURSE_LENGTH_PX);
    const { chassis, frontWheel, rearWheel } = createVehicleBodies(
      vehicle.body,
      vehicle.tire,
      200,
      GROUND_Y - 60
    );
    const frontSuspension = createSuspensionConstraint(chassis, frontWheel, vehicle.suspension);
    const rearSuspension = createSuspensionConstraint(chassis, rearWheel, vehicle.suspension);

    Matter.World.add(engine.world, [
      ...terrainBodies,
      chassis,
      frontWheel,
      rearWheel,
      frontSuspension,
      rearSuspension,
    ]);

    let previousVerticalVelocityPxPerStep = 0;
    let maxImpact = 0;
    let isBottomedOut = false;
    let bottomOutCount = 0;
    let animationTickCount = 0;
    let frontWheelContactCount = 0;
    let rearWheelContactCount = 0;
    let dustParticles: DustParticle[] = [];
    let hasReachedGoal = false;
    // ゴール到達時のリザルト（平均G）算出用に、走行中の|verticalG|を毎tick積算しておく。
    let sumAbsVerticalG = 0;
    let verticalGSampleCount = 0;
    const frontSuspensionRestLengthPx = frontSuspension.length;
    const rearSuspensionRestLengthPx = rearSuspension.length;
    const wheelbasePx = Math.abs(frontWheel.position.x - rearWheel.position.x);
    const wheelRadiusPx = frontWheel.circleRadius ?? 0;
    const groundBodySet = new Set<Matter.Body>(terrainBodies);

    // 画像スプライトで車体を表現するため、Matter.jsの既定描画（矩形・円）は隠す。
    const hideDefaultVehicleRender = () => {
      chassis.render.visible = false;
      frontWheel.render.visible = false;
      rearWheel.render.visible = false;
    };
    if (vehicleSprite.complete) {
      hideDefaultVehicleRender();
    } else {
      vehicleSprite.addEventListener("load", hideDefaultVehicleRender, { once: true });
    }

    // タイヤが地面パーツと接触しているかどうかを衝突イベントで追跡する。
    // 1本のタイヤが複数の地面パーツ（バンプの継ぎ目等）に同時接触することがあるため、
    // 単純なbooleanではなく接触ペア数をカウントし、0より大きい間は接地とみなす。
    const isWheelGroundPair = (pair: Matter.Pair, wheel: Matter.Body) => {
      if (pair.bodyA === wheel) return groundBodySet.has(pair.bodyB);
      if (pair.bodyB === wheel) return groundBodySet.has(pair.bodyA);
      return false;
    };
    const handleCollisionStart = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        if (isWheelGroundPair(pair, frontWheel)) {
          // 非接地→接地への遷移（着地の瞬間）でのみ土煙パーティクルを発生させる
          if (frontWheelContactCount === 0) {
            dustParticles.push(
              ...spawnDustBurst(frontWheel.position.x, frontWheel.position.y, LANDING_DUST_PARTICLE_COUNT)
            );
          }
          frontWheelContactCount += 1;
        }
        if (isWheelGroundPair(pair, rearWheel)) {
          if (rearWheelContactCount === 0) {
            dustParticles.push(
              ...spawnDustBurst(rearWheel.position.x, rearWheel.position.y, LANDING_DUST_PARTICLE_COUNT)
            );
          }
          rearWheelContactCount += 1;
        }
      }
    };
    const handleCollisionEnd = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        if (isWheelGroundPair(pair, frontWheel)) {
          frontWheelContactCount = Math.max(0, frontWheelContactCount - 1);
        }
        if (isWheelGroundPair(pair, rearWheel)) {
          rearWheelContactCount = Math.max(0, rearWheelContactCount - 1);
        }
      }
    };
    Matter.Events.on(engine, "collisionStart", handleCollisionStart);
    Matter.Events.on(engine, "collisionEnd", handleCollisionEnd);

    const handleAfterUpdate = () => {
      // 開始ボタンでシミュレーションが走行中の間、試験速度に応じた水平速度を車体・タイヤへ
      // 直接与えて前進させる（垂直速度は重力・サスペンションによる挙動を保つため変更しない）。
      // タイヤの角速度による摩擦駆動も試したが、Matter.jsの既定重力スケールでは垂直抗力が
      // 小さく生成される摩擦力が不足し、目標速度に対して実測速度が1割程度にしかならなかった
      // ため、この直接制御方式を採用している。
      // ただし無条件に適用すると、タイヤが地面から離れていても・車体が転倒していても
      // 常に一定速度を保ってしまい非現実的なため、shouldApplyDrivingForce()で判定する。
      const { speed } = useSimulationStore.getState().testConditions;
      const drivingVelocityXPerStep = (speed * PIXELS_PER_METER) / STEPS_PER_SECOND;
      const canDrive = shouldApplyDrivingForce({
        isFrontWheelGrounded: frontWheelContactCount > 0,
        isRearWheelGrounded: rearWheelContactCount > 0,
        chassisAngle: chassis.angle,
      });
      if (canDrive) {
        Matter.Body.setVelocity(chassis, { x: drivingVelocityXPerStep, y: chassis.velocity.y });
        Matter.Body.setVelocity(frontWheel, { x: drivingVelocityXPerStep, y: frontWheel.velocity.y });
        Matter.Body.setVelocity(rearWheel, { x: drivingVelocityXPerStep, y: rearWheel.velocity.y });
        Matter.Body.setAngularVelocity(frontWheel, drivingVelocityXPerStep / wheelRadiusPx);
        Matter.Body.setAngularVelocity(rearWheel, drivingVelocityXPerStep / wheelRadiusPx);
      } else {
        // 駆動していない間（空中・転倒中）は、速度の2乗に比例する空気抵抗で自然に減速させる。
        // 駆動中はこの抵抗を適用しても直後の速度強制で上書きされるため、非駆動時のみ適用する。
        const dragDeceleration = computeAirDragDeceleration(chassis.velocity.x);
        Matter.Body.setVelocity(chassis, {
          x: chassis.velocity.x - dragDeceleration,
          y: chassis.velocity.y,
        });
      }
      // 走行中（Runner稼働中）のみカウントを進めることで、開始/一時停止に連動して
      // ホイールアニメーションも止まるようにする（駆動力の有無とは独立に進める）。
      animationTickCount += 1;

      const frontSuspensionLengthPx = Matter.Vector.magnitude(
        Matter.Vector.sub(chassis.position, frontWheel.position)
      );
      const rearSuspensionLengthPx = Matter.Vector.magnitude(
        Matter.Vector.sub(chassis.position, rearWheel.position)
      );
      const result = computeMetrics({
        chassisVelocity: chassis.velocity,
        previousVerticalVelocityPxPerStep,
        frontSuspensionLengthPx,
        frontSuspensionRestLengthPx,
        rearSuspensionLengthPx,
        rearSuspensionRestLengthPx,
        previousMaxImpact: maxImpact,
        strokeLength: vehicle.suspension.strokeLength,
        previousIsBottomedOut: isBottomedOut,
        previousBottomOutCount: bottomOutCount,
      });
      previousVerticalVelocityPxPerStep = result.verticalVelocityPxPerStep;
      maxImpact = result.metrics.maxImpact;
      // 非底付き→底付きへ遷移した瞬間（衝撃音）のみ再生する。底付きが継続している間は鳴らさない。
      if (!isBottomedOut && result.metrics.isBottomedOut) {
        shockSound.play();
      }
      isBottomedOut = result.metrics.isBottomedOut;
      bottomOutCount = result.metrics.bottomOutCount;
      sumAbsVerticalG += Math.abs(result.metrics.verticalG);
      verticalGSampleCount += 1;
      useSimulationStore.getState().setMetrics(result.metrics);

      // 走行中に接地しているタイヤから、確率的に軽い砂埃を発生させ続ける
      if (frontWheelContactCount > 0 && Math.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
        dustParticles.push(...spawnDustBurst(frontWheel.position.x, frontWheel.position.y, 1));
      }
      if (rearWheelContactCount > 0 && Math.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
        dustParticles.push(...spawnDustBurst(rearWheel.position.x, rearWheel.position.y, 1));
      }
      dustParticles = advanceDustParticles(dustParticles);

      // ゴールライン到達を検知し、崖から落下する前にシミュレーションを止める。
      // 1回の走行で1度だけトリガーされ、再度「最初から」するまで再発火しない。
      if (!hasReachedGoal && chassis.position.x >= GOAL_LINE_X_PX) {
        hasReachedGoal = true;
        successSound.play();
        useSimulationStore.getState().setRunning(false);

        const averageAbsVerticalG = verticalGSampleCount > 0 ? sumAbsVerticalG / verticalGSampleCount : 0;
        const elapsedSeconds = animationTickCount / STEPS_PER_SECOND;
        const rank = computeResultRank({ maxImpact, bottomOutCount, averageAbsVerticalG });
        useSimulationStore.getState().setResult({
          rank,
          maxImpact,
          bottomOutCount,
          averageAbsVerticalG,
          elapsedSeconds,
        });
      }
    };
    Matter.Events.on(engine, "afterUpdate", handleAfterUpdate);

    // カメラを車体に追従させ、背景（木・家）が後方へ流れて見えるようにする
    render.options.hasBounds = true;
    const handleBeforeRender = () => {
      const cameraX = Math.max(chassis.position.x, CANVAS_WIDTH / 2);
      // 大きな上下Gを検知した間だけ、カメラを左右に数px微振動させて衝撃を体感的に伝える。
      // 縦方向の揺れは、地形・車体スプライト等の自前描画がworld Y座標をそのまま画面Yとして
      // 扱っている前提を崩してしまうため、横方向のみに限定する。
      const verticalG = useSimulationStore.getState().metrics.verticalG;
      const shakeOffsetX =
        Math.abs(verticalG) > IMPACT_SHAKE_THRESHOLD_G ? (Math.random() - 0.5) * 2 * SHAKE_AMPLITUDE_PX : 0;
      render.bounds.min.x = cameraX - CANVAS_WIDTH / 2 + shakeOffsetX;
      render.bounds.max.x = cameraX + CANVAS_WIDTH / 2 + shakeOffsetX;
      render.bounds.min.y = 0;
      render.bounds.max.y = CANVAS_HEIGHT;
    };
    Matter.Events.on(render, "beforeRender", handleBeforeRender);

    const handleAfterRender = () => {
      const context = render.context;
      const offsetX = render.bounds.min.x;
      context.save();
      // 遠景（山並み・雲）はカメラ移動量にspeedFactorを乗じた分だけ動かし、手前のscenery（木・家）
      // より遅く流れて見えるようにする（視差スクロール）。手前のsceneryより先に描画し、背後に置く。
      for (const layer of parallaxLayers) {
        for (const item of layer.items) {
          const screenX = item.worldX - offsetX * layer.speedFactor;
          if (screenX < -140 || screenX > CANVAS_WIDTH + 140) continue;
          if (item.kind === "mountain") {
            drawMountain(context, screenX, GROUND_Y);
          } else {
            drawCloud(context, screenX);
          }
        }
      }
      for (const item of scenery) {
        const screenX = item.worldX - offsetX;
        if (screenX < -60 || screenX > CANVAS_WIDTH + 60) continue;
        if (item.kind === "tree") {
          drawTree(context, screenX, GROUND_Y);
        } else {
          drawHouse(context, screenX, GROUND_Y);
        }
      }

      for (const particle of dustParticles) {
        const screenX = particle.worldX - offsetX;
        if (screenX < -20 || screenX > CANVAS_WIDTH + 20) continue;
        drawDustParticle(context, particle, screenX);
      }

      const goalScreenX = GOAL_LINE_X_PX - offsetX;
      if (goalScreenX > -20 && goalScreenX < CANVAS_WIDTH + 20) {
        drawGoalLine(context, goalScreenX, GROUND_Y);
      }

      if (vehicleSprite.complete && vehicleSprite.naturalWidth > 0) {
        const targetWidthPx = wheelbasePx + wheelRadiusPx * 2.8;
        const targetHeightPx = targetWidthPx * VEHICLE_SPRITE_ASPECT_RATIO;
        const wheelCenterY = (frontWheel.position.y + rearWheel.position.y) / 2;
        const frameIndex =
          Math.floor(animationTickCount / VEHICLE_SPRITE_STEPS_PER_FRAME) % VEHICLE_SPRITE_FRAME_COUNT;

        context.translate(chassis.position.x - offsetX, wheelCenterY);
        context.rotate(chassis.angle);
        // 画像は左向き（フロントが左）のため、右方向へ進む車体に合わせて左右反転する。
        context.scale(-1, 1);
        context.drawImage(
          vehicleSprite,
          0,
          frameIndex * VEHICLE_SPRITE_FRAME_HEIGHT,
          VEHICLE_SPRITE_FRAME_WIDTH,
          VEHICLE_SPRITE_FRAME_HEIGHT,
          -targetWidthPx / 2,
          -targetHeightPx * VEHICLE_IMAGE_WHEEL_ANCHOR_RATIO,
          targetWidthPx,
          targetHeightPx
        );
      }
      context.restore();

      const frontSpringTop = Matter.Constraint.pointAWorld(frontSuspension);
      const frontSpringBottom = Matter.Constraint.pointBWorld(frontSuspension);
      const rearSpringTop = Matter.Constraint.pointAWorld(rearSuspension);
      const rearSpringBottom = Matter.Constraint.pointBWorld(rearSuspension);
      drawSuspensionSpring(
        context,
        frontSpringTop.x - offsetX,
        frontSpringTop.y,
        frontSpringBottom.x - offsetX,
        frontSpringBottom.y
      );
      drawSuspensionSpring(
        context,
        rearSpringTop.x - offsetX,
        rearSpringTop.y,
        rearSpringBottom.x - offsetX,
        rearSpringBottom.y
      );

      // 底付き（ストローク使い切り）中は画面全体を赤くフラッシュさせ、警告として体感的に伝える。
      if (useSimulationStore.getState().metrics.isBottomedOut) {
        context.save();
        context.fillStyle = "rgba(220, 38, 38, 0.35)";
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.restore();
      }

      if (hasReachedGoal) {
        context.save();
        context.fillStyle = "rgba(15, 118, 110, 0.55)";
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.fillStyle = "#f0fdfa";
        context.font = "bold 48px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("ゴール！", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        context.restore();
      }
    };
    Matter.Events.on(render, "afterRender", handleAfterRender);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    if (useSimulationStore.getState().isRunning) {
      Matter.Runner.run(runner, engine);
    }
    Matter.Render.run(render);

    return () => {
      vehicleSprite.removeEventListener("load", hideDefaultVehicleRender);
      Matter.Events.off(engine, "collisionStart", handleCollisionStart);
      Matter.Events.off(engine, "collisionEnd", handleCollisionEnd);
      Matter.Events.off(engine, "afterUpdate", handleAfterUpdate);
      Matter.Events.off(render, "beforeRender", handleBeforeRender);
      Matter.Events.off(render, "afterRender", handleAfterRender);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      runnerRef.current = null;
    };
  }, [vehicle, terrainType, runToken]);

  useEffect(() => {
    const engine = engineRef.current;
    const runner = runnerRef.current;
    if (!engine || !runner) return;

    if (isRunning) {
      Matter.Runner.run(runner, engine);
    } else {
      Matter.Runner.stop(runner);
    }
  }, [isRunning]);

  return <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} data-testid="vehicle-canvas" />;
}
