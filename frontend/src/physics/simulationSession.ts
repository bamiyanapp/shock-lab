import Matter from "matter-js";
import type { SimulationMetrics, TerrainType, VehicleConfig } from "../types/vehicle";
import type { RetireReason, SimulationResult } from "../store/simulationStore";
import { createWorld } from "./world";
import { createTerrain, COURSE_LENGTH_PX, GOAL_LINE_X_PX } from "./terrain";
import { createVehicleBodies, getAxleArmsPx, getSprungMassKg, type VehicleBodies } from "./vehicle";
import { SuspensionAxle } from "./suspension";
import { computeMetrics, VERTICAL_G_AVERAGE_TICKS } from "./metrics";
import { shouldApplyDrivingForce } from "./driveControl";
import { computeAirDragDeceleration } from "./resistance";
import { createScenery, createParallaxLayers, type SceneryItem, type ParallaxLayer } from "./scenery";
import { spawnDustBurst, advanceDustParticles, type DustParticle } from "./impactEffects";
import { computeResultRank } from "./resultRank";
import { WheelContactTracker } from "./wheelContactTracker";
import { PIXELS_PER_METER, STEPS_PER_SECOND } from "./units";

/** 地面のY座標(px)。地形・車両の初期位置・背景描画の基準になる */
export const GROUND_Y = 300;
const VEHICLE_START_X = 200;
// 着地（非接地→接地）1回あたりに発生させる砂埃パーティクル数。
const LANDING_DUST_PARTICLE_COUNT = 8;
// 走行中に接地しているタイヤから、tickごとにこの確率で軽い砂埃を1粒発生させる。
const ROLLING_DUST_SPAWN_PROBABILITY = 0.15;

// リタイア判定の閾値（tick数・距離）。1tick = 1/60秒。
const OVERTURN_ANGLE_RAD = Math.PI / 2;
const OVERTURN_TICKS = 120; // 2秒
const STUCK_WINDOW_TICKS = 300; // 5秒
const STUCK_MIN_PROGRESS_M = 0.5;
const FELL_OFF_DEPTH_PX = 600;
const DEFAULT_TIMEOUT_TICKS = 10800; // 3分

export interface SimulationSessionOptions {
  vehicle: VehicleConfig;
  terrainType: TerrainType;
  /** 試験速度(m/s)。毎tick読むためgetterで受け取る */
  getSpeed: () => number;
  /** 乱数源。テストでは固定値を返す関数を渡す */
  random?: () => number;
  /** 走行tickがこれを超えたら時間切れでリタイアにする。テストで短くするために指定できる */
  timeoutTicks?: number;
}

export type SimulationEvent =
  | { type: "bottomOut" } // 非底付き→底付きへ遷移した瞬間
  | { type: "goal"; result: SimulationResult }
  // 走行不能で終了した。resultのoutcomeはretireで、rankは判定しない（null）
  | { type: "retire"; reason: RetireReason; result: SimulationResult };

export interface StepOutput {
  metrics: SimulationMetrics;
  /** 現在の走行速度(m/s)。エンジン音のピッチ等に使う */
  speedMetersPerSecond: number;
  events: SimulationEvent[];
}

/**
 * 物理ワールドの構築と毎tickの処理（駆動制御・メトリクス・砂埃・ゴール判定）を担う。
 * Matter.jsには依存するが、React・Zustand・DOM・Audioには依存しない。効果音・ストア更新は
 * 呼び出し側が`afterUpdate()`の戻り値を見て行う。
 */
export class SimulationSession {
  readonly engine: Matter.Engine;
  readonly bodies: VehicleBodies;
  readonly suspensions: { front: SuspensionAxle; rear: SuspensionAxle };
  readonly scenery: SceneryItem[];
  readonly parallaxLayers: ParallaxLayer[];
  readonly wheelbasePx: number;
  readonly wheelRadiusPx: number;
  dustParticles: DustParticle[] = [];
  animationTickCount = 0;
  hasReachedGoal = false;
  /** ゴールまたはリタイアで終了したか。終了後はリタイア判定を行わない */
  hasFinished = false;

  private readonly options: SimulationSessionOptions;
  private readonly random: () => number;
  private readonly wheelContactTracker: WheelContactTracker;
  private readonly recentVerticalAccelerations: number[] = [];
  private readonly startX: number;
  private readonly recentChassisX: number[] = [];
  private overturnedTicks = 0;
  private previousVerticalVelocityPxPerStep = 0;
  private maxImpact = 0;
  private isBottomedOut = false;
  private bottomOutCount = 0;
  // ゴール到達時のリザルト（平均G）算出用に、走行中の|verticalG|を毎tick積算する。
  private sumAbsVerticalG = 0;
  private verticalGSampleCount = 0;

  constructor(options: SimulationSessionOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
    this.startX = VEHICLE_START_X;
    this.engine = createWorld();

    const terrainBodies = createTerrain(options.terrainType, GROUND_Y);
    this.scenery = createScenery(COURSE_LENGTH_PX);
    this.parallaxLayers = createParallaxLayers(COURSE_LENGTH_PX);
    this.bodies = createVehicleBodies(
      options.vehicle.body,
      options.vehicle.tire,
      options.vehicle.suspension,
      VEHICLE_START_X,
      GROUND_Y
    );
    const { chassis, frontWheel, rearWheel } = this.bodies;
    const { body, suspension } = options.vehicle;
    const arms = getAxleArmsPx(body);
    const sprungMassKg = getSprungMassKg(body.weightKg);
    this.suspensions = {
      front: new SuspensionAxle(chassis, frontWheel, arms.front, suspension, sprungMassKg, body.frontWeightRatio),
      rear: new SuspensionAxle(chassis, rearWheel, -arms.rear, suspension, sprungMassKg, 1 - body.frontWeightRatio),
    };
    Matter.World.add(this.engine.world, [
      ...terrainBodies,
      chassis,
      frontWheel,
      rearWheel,
    ]);

    this.wheelbasePx = Math.abs(frontWheel.position.x - rearWheel.position.x);
    this.wheelRadiusPx = frontWheel.circleRadius ?? 0;

    // 非接地→接地への遷移（着地の瞬間）でのみ土煙パーティクルを発生させる
    this.wheelContactTracker = new WheelContactTracker(terrainBodies, frontWheel, rearWheel, (wheel) => {
      this.dustParticles.push(
        ...spawnDustBurst(wheel.position.x, wheel.position.y, LANDING_DUST_PARTICLE_COUNT, this.random)
      );
    });
    Matter.Events.on(this.engine, "collisionStart", this.wheelContactTracker.handleCollisionStart);
    Matter.Events.on(this.engine, "collisionEnd", this.wheelContactTracker.handleCollisionEnd);
    // サスペンションの力は位置更新の前、ストローク制限・横方向の拘束は位置更新の後に適用する。
    Matter.Events.on(this.engine, "beforeUpdate", this.applySuspensionForces);
    Matter.Events.on(this.engine, "afterUpdate", this.constrainSuspensions);
  }

  private readonly applySuspensionForces = () => {
    this.suspensions.front.applyForces();
    this.suspensions.rear.applyForces();
  };

  private readonly constrainSuspensions = () => {
    this.suspensions.front.constrain();
    this.suspensions.rear.constrain();
  };

  /** engineのafterUpdateで呼ぶ1tickぶんの処理 */
  afterUpdate(): StepOutput {
    const events: SimulationEvent[] = [];
    this.applyDriving();
    // 走行中（Runner稼働中）のみカウントを進めることで、開始/一時停止に連動して
    // ホイールアニメーションも止まるようにする（駆動力の有無とは独立に進める）。
    this.animationTickCount += 1;

    const { chassis } = this.bodies;
    const chassisVelocity = Matter.Body.getVelocity(chassis);
    const speedMetersPerSecond = (chassisVelocity.x * STEPS_PER_SECOND) / PIXELS_PER_METER;
    const metrics = this.updateMetrics(events);
    this.updateDust();
    this.checkGoal(events);
    this.checkRetire(events);
    return { metrics, speedMetersPerSecond, events };
  }

  /** テスト用: Matter.Engine.update(engine, 1000/60)とafterUpdate()を1回ずつ実行する */
  stepForTest(): StepOutput {
    Matter.Engine.update(this.engine, 1000 / STEPS_PER_SECOND);
    return this.afterUpdate();
  }

  dispose(): void {
    Matter.Events.off(this.engine, "collisionStart", this.wheelContactTracker.handleCollisionStart);
    Matter.Events.off(this.engine, "collisionEnd", this.wheelContactTracker.handleCollisionEnd);
    Matter.Events.off(this.engine, "beforeUpdate", this.applySuspensionForces);
    Matter.Events.off(this.engine, "afterUpdate", this.constrainSuspensions);
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
  }

  // 試験速度に応じた水平速度を車体・タイヤへ直接与えて前進させる（垂直速度は重力・
  // サスペンションによる挙動を保つため変更しない）。タイヤの角速度による摩擦駆動は、
  // Matter.jsの既定重力スケールでは垂直抗力が小さく摩擦力が不足するため採用していない。
  // 無条件に適用するとタイヤが地面から離れていても・転倒していても一定速度を保って
  // しまうため、shouldApplyDrivingForce()で判定する。
  private applyDriving(): void {
    const { chassis, frontWheel, rearWheel } = this.bodies;
    // body.velocityは衝突解決後に更新されないため、位置の差分から速度を求める。
    const chassisVelocity = Matter.Body.getVelocity(chassis);
    const frontVelocity = Matter.Body.getVelocity(frontWheel);
    const rearVelocity = Matter.Body.getVelocity(rearWheel);
    const drivingVelocityXPerStep = (this.options.getSpeed() * PIXELS_PER_METER) / STEPS_PER_SECOND;
    const canDrive = shouldApplyDrivingForce({
      isFrontWheelGrounded: this.wheelContactTracker.frontWheelContactCount > 0,
      isRearWheelGrounded: this.wheelContactTracker.rearWheelContactCount > 0,
      chassisAngle: chassis.angle,
    });
    if (canDrive) {
      Matter.Body.setVelocity(chassis, { x: drivingVelocityXPerStep, y: chassisVelocity.y });
      Matter.Body.setVelocity(frontWheel, { x: drivingVelocityXPerStep, y: frontVelocity.y });
      Matter.Body.setVelocity(rearWheel, { x: drivingVelocityXPerStep, y: rearVelocity.y });
    } else {
      // 駆動していない間（空中・転倒中）は、速度の2乗に比例する空気抵抗で自然に減速させる。
      const dragDeceleration = computeAirDragDeceleration(chassisVelocity.x);
      Matter.Body.setVelocity(chassis, { x: chassisVelocity.x - dragDeceleration, y: chassisVelocity.y });
    }
  }

  private updateMetrics(events: SimulationEvent[]): SimulationMetrics {
    const chassisVelocity = Matter.Body.getVelocity(this.bodies.chassis);
    this.recentVerticalAccelerations.push(chassisVelocity.y - this.previousVerticalVelocityPxPerStep);
    if (this.recentVerticalAccelerations.length > VERTICAL_G_AVERAGE_TICKS) this.recentVerticalAccelerations.shift();
    this.previousVerticalVelocityPxPerStep = chassisVelocity.y;
    const metrics = computeMetrics({
      chassisVelocity,
      recentVerticalAccelerationsPxPerStep2: this.recentVerticalAccelerations,
      frontStrokeM: this.suspensions.front.getCompression(),
      rearStrokeM: this.suspensions.rear.getCompression(),
      previousMaxImpact: this.maxImpact,
      strokeLength: this.options.vehicle.suspension.strokeLength,
      previousIsBottomedOut: this.isBottomedOut,
      previousBottomOutCount: this.bottomOutCount,
    });
    this.maxImpact = metrics.maxImpact;
    // 非底付き→底付きへ遷移した瞬間のみ通知する。底付きが継続している間は通知しない。
    if (!this.isBottomedOut && metrics.isBottomedOut) {
      events.push({ type: "bottomOut" });
    }
    this.isBottomedOut = metrics.isBottomedOut;
    this.bottomOutCount = metrics.bottomOutCount;
    this.sumAbsVerticalG += Math.abs(metrics.verticalG);
    this.verticalGSampleCount += 1;
    return metrics;
  }

  // 走行中に接地しているタイヤから、確率的に軽い砂埃を発生させ続ける（見た目の演出用途）。
  private updateDust(): void {
    const { frontWheel, rearWheel } = this.bodies;
    if (this.wheelContactTracker.frontWheelContactCount > 0 && this.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
      this.dustParticles.push(...spawnDustBurst(frontWheel.position.x, frontWheel.position.y, 1, this.random));
    }
    if (this.wheelContactTracker.rearWheelContactCount > 0 && this.random() < ROLLING_DUST_SPAWN_PROBABILITY) {
      this.dustParticles.push(...spawnDustBurst(rearWheel.position.x, rearWheel.position.y, 1, this.random));
    }
    this.dustParticles = advanceDustParticles(this.dustParticles);
  }

  // ゴールライン到達を検知する。1回の走行で1度だけ発火し、作り直すまで再発火しない。
  private checkGoal(events: SimulationEvent[]): void {
    if (this.hasFinished || this.bodies.chassis.position.x < GOAL_LINE_X_PX) return;
    this.hasReachedGoal = true;
    this.hasFinished = true;
    const averageAbsVerticalG = this.verticalGSampleCount > 0 ? this.sumAbsVerticalG / this.verticalGSampleCount : 0;
    const stats = { maxImpact: this.maxImpact, bottomOutCount: this.bottomOutCount, averageAbsVerticalG };
    events.push({
      type: "goal",
      result: this.buildResult("goal", computeResultRank(stats)),
    });
  }

  private buildResult(outcome: "goal" | "retire", rank: SimulationResult["rank"], retireReason?: RetireReason): SimulationResult {
    const averageAbsVerticalG = this.verticalGSampleCount > 0 ? this.sumAbsVerticalG / this.verticalGSampleCount : 0;
    return {
      outcome,
      ...(retireReason ? { retireReason } : {}),
      rank,
      maxImpact: this.maxImpact,
      bottomOutCount: this.bottomOutCount,
      averageAbsVerticalG,
      elapsedSeconds: this.animationTickCount / STEPS_PER_SECOND,
      distanceMeters: Math.max(0, (this.bodies.chassis.position.x - this.startX) / PIXELS_PER_METER),
    };
  }

  // 走行不能（転倒・立ち往生・コースアウト・時間切れ）を検知し、1回だけretireイベントを出す。
  private checkRetire(events: SimulationEvent[]): void {
    if (this.hasFinished) return;
    const reason = this.detectRetireReason();
    if (!reason) return;
    this.hasFinished = true;
    events.push({ type: "retire", reason, result: this.buildResult("retire", null, reason) });
  }

  private detectRetireReason(): RetireReason | null {
    const { chassis } = this.bodies;
    this.overturnedTicks = Math.abs(chassis.angle) > OVERTURN_ANGLE_RAD ? this.overturnedTicks + 1 : 0;
    if (this.overturnedTicks >= OVERTURN_TICKS) return "overturned";
    if (chassis.position.y > GROUND_Y + FELL_OFF_DEPTH_PX) return "fellOff";

    this.recentChassisX.push(chassis.position.x);
    // 直近STUCK_WINDOW_TICKS tickの前進量で判定する（開始直後の窓が埋まるまでは判定しない）。
    if (this.recentChassisX.length > STUCK_WINDOW_TICKS + 1) this.recentChassisX.shift();
    if (
      this.recentChassisX.length > STUCK_WINDOW_TICKS &&
      (chassis.position.x - this.recentChassisX[0]) / PIXELS_PER_METER < STUCK_MIN_PROGRESS_M
    ) {
      return "stuck";
    }
    if (this.animationTickCount > (this.options.timeoutTicks ?? DEFAULT_TIMEOUT_TICKS)) return "timeout";
    return null;
  }
}
