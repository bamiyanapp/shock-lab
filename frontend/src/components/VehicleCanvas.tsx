import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createWorld } from "../physics/world";
import { createTerrain, COURSE_LENGTH_PX } from "../physics/terrain";
import { createVehicleBodies } from "../physics/vehicle";
import { createSuspensionConstraint } from "../physics/suspension";
import { computeMetrics } from "../physics/metrics";
import { createScenery } from "../physics/scenery";
import { useSimulationStore } from "../store/simulationStore";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 300;
const STEPS_PER_SECOND = 60;

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
    const frontSuspensionRestLengthPx = frontSuspension.length;
    const tireRadiusM = vehicle.tire.diameter / 2;

    const handleAfterUpdate = () => {
      // 開始ボタンでシミュレーションが走行中の間、試験速度に応じた角速度をタイヤに与えて前進させる
      const { speed } = useSimulationStore.getState().testConditions;
      const drivingAngularVelocityPerStep = speed / tireRadiusM / STEPS_PER_SECOND;
      Matter.Body.setAngularVelocity(frontWheel, drivingAngularVelocityPerStep);
      Matter.Body.setAngularVelocity(rearWheel, drivingAngularVelocityPerStep);

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
