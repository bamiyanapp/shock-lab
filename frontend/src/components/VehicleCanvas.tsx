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
import { WheelContactTracker } from "../physics/wheelContactTracker";
import { useSimulationStore } from "../store/simulationStore";
import { shockSound, successSound } from "../audio/soundEffects";
import { startEngineSound, stopEngineSound, setEngineSoundSpeed } from "../audio/engineSound";
import vehicleSpriteUrl from "../assets/vehicle-sprite.png";
import {
  drawGoalLine,
  drawBackground,
  drawDustParticles,
  drawVehicleSprite,
  drawSuspensionSprings,
  drawStatusOverlays,
  getFullscreenWrapperStyle,
} from "./vehicleCanvasRendering";
import { CloseFullscreenButton } from "./VehicleCanvasFullscreen";

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

const vehicleSprite = new Image();
vehicleSprite.src = vehicleSpriteUrl;

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
    let dustParticles: DustParticle[] = [];
    let hasReachedGoal = false;
    // ゴール到達時のリザルト（平均G）算出用に、走行中の|verticalG|を毎tick積算しておく。
    let sumAbsVerticalG = 0;
    let verticalGSampleCount = 0;
    const frontSuspensionRestLengthPx = frontSuspension.length;
    const rearSuspensionRestLengthPx = rearSuspension.length;
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

    // 非接地→接地への遷移（着地の瞬間）でのみ土煙パーティクルを発生させる
    const wheelContactTracker = new WheelContactTracker(terrainBodies, frontWheel, rearWheel, (wheel) => {
      dustParticles.push(...spawnDustBurst(wheel.position.x, wheel.position.y, LANDING_DUST_PARTICLE_COUNT));
    });
    Matter.Events.on(engine, "collisionStart", wheelContactTracker.handleCollisionStart);
    Matter.Events.on(engine, "collisionEnd", wheelContactTracker.handleCollisionEnd);

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
        isFrontWheelGrounded: wheelContactTracker.frontWheelContactCount > 0,
        isRearWheelGrounded: wheelContactTracker.rearWheelContactCount > 0,
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

      // エンジン音のピッチを実際の走行速度（m/s）へ反映する（issue #53）。
      const currentSpeedMetersPerSecond = (chassis.velocity.x * STEPS_PER_SECOND) / PIXELS_PER_METER;
      setEngineSoundSpeed(currentSpeedMetersPerSecond);

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

      // 走行中に接地しているタイヤから、確率的に軽い砂埃を発生させ続ける。見た目の演出用途のみで
      // セキュリティ上の意味は無いため、暗号論的に安全な乱数は不要（sonarjs/pseudo-random）。
      // eslint-disable-next-line sonarjs/pseudo-random
      if (wheelContactTracker.frontWheelContactCount > 0 && Math.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
        dustParticles.push(...spawnDustBurst(frontWheel.position.x, frontWheel.position.y, 1));
      }
      // eslint-disable-next-line sonarjs/pseudo-random
      if (wheelContactTracker.rearWheelContactCount > 0 && Math.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
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
      // カメラ振動の見た目の演出用途のみで、セキュリティ上の意味は無い（sonarjs/pseudo-random）。
      const shakeOffsetX =
        Math.abs(verticalG) > IMPACT_SHAKE_THRESHOLD_G
          // eslint-disable-next-line sonarjs/pseudo-random
          ? (Math.random() - 0.5) * 2 * SHAKE_AMPLITUDE_PX
          : 0;
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
      drawBackground(context, parallaxLayers, scenery, offsetX, CANVAS_WIDTH, GROUND_Y);
      drawDustParticles(context, dustParticles, offsetX, CANVAS_WIDTH);

      const goalScreenX = GOAL_LINE_X_PX - offsetX;
      if (goalScreenX > -20 && goalScreenX < CANVAS_WIDTH + 20) {
        drawGoalLine(context, goalScreenX, GROUND_Y);
      }

      drawVehicleSprite(context, {
        sprite: vehicleSprite,
        frontWheel,
        rearWheel,
        chassis,
        wheelbasePx,
        wheelRadiusPx,
        animationTickCount,
        offsetX,
      });
      context.restore();

      drawSuspensionSprings(context, frontSuspension, rearSuspension, offsetX);
      drawStatusOverlays(
        context,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        useSimulationStore.getState().metrics.isBottomedOut,
        hasReachedGoal
      );
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
      Matter.Events.off(engine, "collisionStart", wheelContactTracker.handleCollisionStart);
      Matter.Events.off(engine, "collisionEnd", wheelContactTracker.handleCollisionEnd);
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
      startEngineSound();
    } else {
      Matter.Runner.stop(runner);
      stopEngineSound();
    }

    return () => {
      stopEngineSound();
    };
  }, [isRunning]);

  // canvas要素自体は常に同じ位置・同じラッパーの子として描画し続ける（isRunningの
  // 変化でcanvasごとマウント解除・再マウントされると、初回のuseEffectで
  // Matter.Render.create()に渡したcanvas要素がDOMから外れ、以後描画が反映されなく
  // なるため）。フルスクリーン表示自体の設計はVehicleCanvasFullscreen.tsx参照。
  return (
    <div style={getFullscreenWrapperStyle(isRunning)}>
      {isRunning && <CloseFullscreenButton onClose={() => useSimulationStore.getState().setRunning(false)} />}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        data-testid="vehicle-canvas"
        style={isRunning ? { maxWidth: "100vw", maxHeight: "100vh", width: "auto", height: "auto" } : undefined}
      />
    </div>
  );
}
