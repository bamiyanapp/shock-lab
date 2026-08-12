import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createWorld } from "../physics/world";
import { createTerrain, COURSE_LENGTH_PX } from "../physics/terrain";
import { createVehicleBodies } from "../physics/vehicle";
import { createSuspensionConstraint } from "../physics/suspension";
import { computeMetrics } from "../physics/metrics";
import { shouldApplyDrivingForce } from "../physics/driveControl";
import { computeAirDragDeceleration } from "../physics/resistance";
import { createScenery, createParallaxLayers } from "../physics/scenery";
import { useSimulationStore } from "../store/simulationStore";
import vehicleSpriteUrl from "../assets/vehicle-sprite.png";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 300;
const STEPS_PER_SECOND = 60;
const PIXELS_PER_METER = 60;

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
        if (isWheelGroundPair(pair, frontWheel)) frontWheelContactCount += 1;
        if (isWheelGroundPair(pair, rearWheel)) rearWheelContactCount += 1;
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
      isBottomedOut = result.metrics.isBottomedOut;
      bottomOutCount = result.metrics.bottomOutCount;
      useSimulationStore.getState().setMetrics(result.metrics);
    };
    Matter.Events.on(engine, "afterUpdate", handleAfterUpdate);

    // カメラを車体に追従させ、背景（木・家）が後方へ流れて見えるようにする
    render.options.hasBounds = true;
    const handleBeforeRender = () => {
      const cameraX = Math.max(chassis.position.x, CANVAS_WIDTH / 2);
      render.bounds.min.x = cameraX - CANVAS_WIDTH / 2;
      render.bounds.max.x = cameraX + CANVAS_WIDTH / 2;
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

      // 底付き（ストローク使い切り）中は画面全体を赤くフラッシュさせ、警告として体感的に伝える。
      if (useSimulationStore.getState().metrics.isBottomedOut) {
        context.save();
        context.fillStyle = "rgba(220, 38, 38, 0.35)";
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
  }, [vehicle, terrainType]);

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
