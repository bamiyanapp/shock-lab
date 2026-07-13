import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createWorld } from "../physics/world";
import { createTerrain, COURSE_LENGTH_PX } from "../physics/terrain";
import { createVehicleBodies } from "../physics/vehicle";
import { createSuspensionConstraint } from "../physics/suspension";
import { computeMetrics } from "../physics/metrics";
import { createScenery } from "../physics/scenery";
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
    let animationTickCount = 0;
    const frontSuspensionRestLengthPx = frontSuspension.length;
    const wheelbasePx = Math.abs(frontWheel.position.x - rearWheel.position.x);
    const wheelRadiusPx = frontWheel.circleRadius ?? 0;

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

    const handleAfterUpdate = () => {
      // 開始ボタンでシミュレーションが走行中の間、試験速度に応じた水平速度を車体・タイヤへ
      // 直接与えて前進させる（垂直速度は重力・サスペンションによる挙動を保つため変更しない）。
      // タイヤの角速度による摩擦駆動も試したが、Matter.jsの既定重力スケールでは垂直抗力が
      // 小さく生成される摩擦力が不足し、目標速度に対して実測速度が1割程度にしかならなかった
      // ため、この直接制御方式を採用している。
      const { speed } = useSimulationStore.getState().testConditions;
      const drivingVelocityXPerStep = (speed * PIXELS_PER_METER) / STEPS_PER_SECOND;
      Matter.Body.setVelocity(chassis, { x: drivingVelocityXPerStep, y: chassis.velocity.y });
      Matter.Body.setVelocity(frontWheel, { x: drivingVelocityXPerStep, y: frontWheel.velocity.y });
      Matter.Body.setVelocity(rearWheel, { x: drivingVelocityXPerStep, y: rearWheel.velocity.y });
      Matter.Body.setAngularVelocity(frontWheel, drivingVelocityXPerStep / wheelRadiusPx);
      Matter.Body.setAngularVelocity(rearWheel, drivingVelocityXPerStep / wheelRadiusPx);
      // 走行中（Runner稼働中）のみカウントを進めることで、開始/一時停止に連動して
      // ホイールアニメーションも止まるようにする。
      animationTickCount += 1;

      const frontSuspensionLengthPx = Matter.Vector.magnitude(
        Matter.Vector.sub(chassis.position, frontWheel.position)
      );
      const result = computeMetrics({
        chassisVelocity: chassis.velocity,
        previousVerticalVelocityPxPerStep,
        frontSuspensionLengthPx,
        frontSuspensionRestLengthPx,
        previousMaxImpact: maxImpact,
      });
      previousVerticalVelocityPxPerStep = result.verticalVelocityPxPerStep;
      maxImpact = result.metrics.maxImpact;
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
