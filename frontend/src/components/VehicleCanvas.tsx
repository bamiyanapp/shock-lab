import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { createWorld } from "../physics/world";
import { createTerrain } from "../physics/terrain";
import { createVehicleBodies } from "../physics/vehicle";
import { createSuspensionConstraint } from "../physics/suspension";
import { computeMetrics } from "../physics/metrics";
import { useSimulationStore } from "../store/simulationStore";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 300;
const STEPS_PER_SECOND = 60;

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

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    if (useSimulationStore.getState().isRunning) {
      Matter.Runner.run(runner, engine);
    }
    Matter.Render.run(render);

    return () => {
      Matter.Events.off(engine, "afterUpdate", handleAfterUpdate);
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
