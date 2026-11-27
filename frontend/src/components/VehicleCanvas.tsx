import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { SimulationSession, GROUND_Y } from "../physics/simulationSession";
import { GOAL_LINE_X_PX, createPreviewObstacles } from "../physics/terrain";
import { useSimulationStore } from "../store/simulationStore";
import { shockSound, successSound } from "../audio/soundEffects";
import { startEngineSound, stopEngineSound, setEngineSoundSpeed } from "../audio/engineSound";
import { selectEngineProfile } from "../audio/engineSoundParams";
import {
  drawGoalLine,
  drawBackground,
  drawTerrain,
  drawDustParticles,
  drawSuspensionSprings,
  drawStatusOverlays,
  getFullscreenWrapperStyle,
} from "./vehicleCanvasRendering";
import { drawVehicle } from "./vehicleDrawing";
import { getCanvasStyle } from "./canvasLayout";
import { useIsPortrait } from "../hooks/useIsPortrait";
import { usePauseWhenHidden } from "../hooks/usePauseWhenHidden";
import { FullscreenHud } from "./VehicleCanvasFullscreen";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
// この値を超える上下Gを検知するとカメラを微振動させる（衝撃の体感フィードバック）。
const IMPACT_SHAKE_THRESHOLD_G = 1.5;
const SHAKE_AMPLITUDE_PX = 4;

export function VehicleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isRunning = useSimulationStore((state) => state.phase === "running");
  const runToken = useSimulationStore((state) => state.runToken);
  const isPortrait = useIsPortrait();
  usePauseWhenHidden();

  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 構築に使う車両・路面はここで読む。設定の変更はストアがrunTokenを進めることで再構築を起こす。
    const { vehicle, testConditions } = useSimulationStore.getState();
    const session = new SimulationSession({
      vehicle,
      terrainType: testConditions.terrainType,
      getSpeed: () => useSimulationStore.getState().testConditions.speed,
    });
    const { engine } = session;
    engineRef.current = engine;
    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine,
      options: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, wireframes: false, background: "#0f172a" },
    });
    const { chassis, frontWheel, rearWheel } = session.bodies;

    // 車体・タイヤは自前で描くため、Matter.jsの既定描画（矩形・円）は隠す。
    chassis.render.visible = false;
    frontWheel.render.visible = false;
    rearWheel.render.visible = false;

    // セッションの1tick結果を、ストア・効果音へ橋渡しする。
    const handleAfterUpdate = () => {
      const { metrics, sample, speedMetersPerSecond, events } = session.afterUpdate();
      setEngineSoundSpeed(speedMetersPerSecond, Math.abs(metrics.verticalG));
      // ストアへの反映は10Hz（履歴のサンプルが確定したtickのみ）。底付き・ゴール等のイベントと
      // canvasの描画はセッションから直接読むため、発生tickで即時に処理できる。
      if (sample) useSimulationStore.getState().setMetrics(metrics, sample);
      for (const event of events) {
        if (event.type === "bottomOut") {
          shockSound.play();
        } else {
          // ゴールのみ成功音を鳴らす。リタイア時は鳴らさない。
          if (event.type === "goal") successSound.play();
          useSimulationStore.getState().finishRun(event.result);
        }
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
      const verticalG = session.latestMetrics.verticalG;
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

    // 待機中は、実際の地形の最初の障害物が約25m先で見えないため、選んだ路面のサンプルを車の前方へ見せる
    // （issue #551）。路面を変えると、ストアが走行を作り直し、このeffectがやり直されてサンプルも切り替わる。
    const previewObstacles = createPreviewObstacles(testConditions.terrainType, GROUND_Y);

    const handleAfterRender = () => {
      const context = render.context;
      const offsetX = render.bounds.min.x;
      context.save();
      drawBackground(context, session.parallaxLayers, session.scenery, offsetX, CANVAS_WIDTH, GROUND_Y);
      drawTerrain(context, session.terrainBodies, offsetX, CANVAS_WIDTH, GROUND_Y);
      if (useSimulationStore.getState().phase === "idle") drawTerrain(context, previewObstacles, offsetX, CANVAS_WIDTH, GROUND_Y);
      drawDustParticles(context, session.dustParticles, offsetX, CANVAS_WIDTH);

      const goalScreenX = GOAL_LINE_X_PX - offsetX;
      if (goalScreenX > -20 && goalScreenX < CANVAS_WIDTH + 20) {
        drawGoalLine(context, goalScreenX, GROUND_Y);
      }

      drawVehicle(context, {
        chassis,
        frontWheel,
        rearWheel,
        frontArmPx: session.suspensions.front.armPx,
        rearArmPx: session.suspensions.rear.armPx,
        wheelRadiusPx: session.wheelRadiusPx,
        offsetX,
      });
      context.restore();

      drawSuspensionSprings(context, session.suspensions.front, session.suspensions.rear, offsetX);
      drawStatusOverlays(
        context,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        session.latestMetrics.isBottomedOut,
        session.hasReachedGoal
      );
    };
    Matter.Events.on(render, "afterRender", handleAfterRender);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    if (useSimulationStore.getState().phase === "running") {
      Matter.Runner.run(runner, engine);
    }
    Matter.Render.run(render);

    return () => {
      Matter.Events.off(engine, "afterUpdate", handleAfterUpdate);
      Matter.Events.off(render, "beforeRender", handleBeforeRender);
      Matter.Events.off(render, "afterRender", handleAfterRender);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      session.dispose();
      engineRef.current = null;
      runnerRef.current = null;
    };
  }, [runToken]);

  useEffect(() => {
    const engine = engineRef.current;
    const runner = runnerRef.current;
    if (!engine || !runner) return;

    if (isRunning) {
      Matter.Runner.run(runner, engine);
      startEngineSound(selectEngineProfile(useSimulationStore.getState().vehicle));
    } else {
      Matter.Runner.stop(runner);
      stopEngineSound();
    }

    return () => {
      stopEngineSound();
    };
  }, [isRunning]);

  // フルスクリーン表示中はEscキーで一時停止（閉じるボタンと同じ操作）できるようにする。
  useEffect(() => {
    if (!isRunning) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") useSimulationStore.getState().pauseRun();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning]);

  // canvas要素自体は常に同じ位置・同じラッパーの子として描画し続ける（isRunningの
  // 変化でcanvasごとマウント解除・再マウントされると、初回のuseEffectで
  // Matter.Render.create()に渡したcanvas要素がDOMから外れ、以後描画が反映されなく
  // なるため）。フルスクリーン表示自体の設計はVehicleCanvasFullscreen.tsx参照。
  return (
    <div style={getFullscreenWrapperStyle(isRunning)}>
      {isRunning && <FullscreenHud onPause={() => useSimulationStore.getState().pauseRun()} />}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        role="img"
        aria-label="車両走行シミュレーション"
        data-testid="vehicle-canvas"
        style={getCanvasStyle(isRunning, isPortrait)}
      />
    </div>
  );
}
