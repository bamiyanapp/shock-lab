import Matter from "matter-js";
import type { SuspensionParams } from "../types/vehicle";
import { NEWTON_TO_MATTER_FORCE, PIXELS_PER_METER, STEPS_PER_SECOND, UNSPRUNG_MASS_KG } from "./units";
import { computeFreeLengthM } from "./vehicleGeometry";

// スライダー値は1輪あたり。2Dの1軸は左右2輪ぶんなので2倍する。
const WHEELS_PER_AXLE = 2;
const STEP_SECONDS = 1 / STEPS_PER_SECOND;

/**
 * 1軸ぶんのサスペンション。Matter.Constraintのstiffness/dampingではなく、バネ・ダンパーの
 * 力[N]を毎tick明示的に加える（physics-model.md参照）。
 * タイヤは車体ローカルの下方向（axis）にだけ動き、圧縮量がストローク値になる。
 */
export class SuspensionAxle {
  readonly chassis: Matter.Body;
  readonly wheel: Matter.Body;
  /** 車体の重心からアンカーまでの水平距離(px)。前軸は正、後軸は負 */
  readonly armPx: number;
  /** 取り付け点の、車体の重心からの縦のずれ(px。車体の下向きが正)。前後のたわみの差を吸収する */
  readonly anchorOffsetPx: number;
  private readonly restLengthPx: number;
  private readonly strokeM: number;
  private readonly springN: number;
  private readonly damperNs: number;
  private readonly reducedMassKg: number;

  constructor(
    chassis: Matter.Body,
    wheel: Matter.Body,
    armPx: number,
    params: SuspensionParams,
    sprungMassKg: number,
    loadRatio: number,
    anchorOffsetPx = 0
  ) {
    this.chassis = chassis;
    this.wheel = wheel;
    this.armPx = armPx;
    this.anchorOffsetPx = anchorOffsetPx;
    // 圧縮量の基準は、バネの自由長（荷重ゼロの長さ）。静止時は、荷重のぶん縮んだ状態になる（issue #557）。
    this.restLengthPx = computeFreeLengthM(params.mountHeight, params.strokeLength) * PIXELS_PER_METER;
    this.strokeM = params.strokeLength;
    this.springN = WHEELS_PER_AXLE * params.springConstant;
    this.damperNs = WHEELS_PER_AXLE * params.damperCoefficient;
    const axleSprungKg = sprungMassKg * loadRatio;
    this.reducedMassKg = (axleSprungKg * UNSPRUNG_MASS_KG) / (axleSprungKg + UNSPRUNG_MASS_KG);
  }

  /** 車体の向きから求めた、軸方向（下向き）と、それに垂直な方向の単位ベクトル */
  private basis() {
    const angle = this.chassis.angle;
    return {
      axis: { x: -Math.sin(angle), y: Math.cos(angle) },
      perp: { x: Math.cos(angle), y: Math.sin(angle) },
    };
  }

  /** 車体の重心から取り付け点までのベクトル（px）。水平方向の腕＋縦のずれ */
  private anchorArm() {
    const { axis, perp } = this.basis();
    return {
      x: perp.x * this.armPx + axis.x * this.anchorOffsetPx,
      y: perp.y * this.armPx + axis.y * this.anchorOffsetPx,
    };
  }

  private anchor() {
    const arm = this.anchorArm();
    return { x: this.chassis.position.x + arm.x, y: this.chassis.position.y + arm.y };
  }

  private anchorVelocity() {
    // 車体の並進速度＋回転による速度（ω × r）。単位はpx/step。
    // body.velocityは衝突解決後に更新されないため、位置の差分から求める。
    const arm = this.anchorArm();
    const omega = Matter.Body.getAngularVelocity(this.chassis);
    const velocity = Matter.Body.getVelocity(this.chassis);
    return {
      x: velocity.x - omega * arm.y,
      y: velocity.y + omega * arm.x,
    };
  }

  /** 圧縮量[m]。縮むと正。ストローク値の定義 */
  getCompression(): number {
    const { axis } = this.basis();
    const anchor = this.anchor();
    const length = (this.wheel.position.x - anchor.x) * axis.x + (this.wheel.position.y - anchor.y) * axis.y;
    return (this.restLengthPx - length) / PIXELS_PER_METER;
  }

  /** 描画用。バネの上端（車体のアンカー）と下端（タイヤ中心）のワールド座標 */
  getSpringEnds(): { top: { x: number; y: number }; bottom: { x: number; y: number } } {
    return { top: this.anchor(), bottom: { x: this.wheel.position.x, y: this.wheel.position.y } };
  }

  /** beforeUpdateで呼ぶ。バネ・ダンパーの力を車体のアンカー点とタイヤへ加える */
  applyForces(): void {
    const { axis } = this.basis();
    const anchor = this.anchor();
    const compression = this.getCompression();
    const anchorVelocity = this.anchorVelocity();
    // 圧縮速度[m/s]（1px/step = 1m/s）。縮む向きが正。
    const wheelVelocity = Matter.Body.getVelocity(this.wheel);
    const compressionSpeed =
      -((wheelVelocity.x - anchorVelocity.x) * axis.x + (wheelVelocity.y - anchorVelocity.y) * axis.y);
    // 陰解法に相当する形でダンパー力を求め、大きな減衰係数でも1tickで相対速度が逆転して
    // 発散しないようにする（c/(1+c·Δt/m)）。
    const effectiveDamper = this.damperNs / (1 + (this.damperNs * STEP_SECONDS) / this.reducedMassKg);
    // 静止荷重の打ち消しは無い。静止時は、荷重ぶんだけ縮んだ位置で釣り合う（issue #557）。
    const forceN = this.springN * compression + effectiveDamper * compressionSpeed;
    const force = forceN * NEWTON_TO_MATTER_FORCE;
    Matter.Body.applyForce(this.chassis, anchor, { x: -axis.x * force, y: -axis.y * force });
    Matter.Body.applyForce(this.wheel, this.wheel.position, { x: axis.x * force, y: axis.y * force });
  }

  /** afterUpdateで呼ぶ。ストローク制限（バンプストップ）と横方向の拘束を適用する */
  constrain(): void {
    const { axis, perp } = this.basis();
    const anchor = this.anchor();
    const anchorVelocity = this.anchorVelocity();
    const relX = this.wheel.position.x - anchor.x;
    const relY = this.wheel.position.y - anchor.y;
    const length = relX * axis.x + relY * axis.y;
    const lateral = relX * perp.x + relY * perp.y;

    // 軸方向: 圧縮量が±strokeを超えたら限界位置へ戻す
    const compressionM = (this.restLengthPx - length) / PIXELS_PER_METER;
    const clampedCompressionM = Math.max(-this.strokeM, Math.min(this.strokeM, compressionM));
    const targetLength = this.restLengthPx - clampedCompressionM * PIXELS_PER_METER;
    const axialShift = targetLength - length;
    const wheelVelocity = Matter.Body.getVelocity(this.wheel);
    const wheelVelocityRelative = { x: wheelVelocity.x - anchorVelocity.x, y: wheelVelocity.y - anchorVelocity.y };
    let axialVelocity = wheelVelocityRelative.x * axis.x + wheelVelocityRelative.y * axis.y;
    // 限界を超えようとしていた向きの相対速度のみ0にする（バンプストップは非弾性）
    if (compressionM !== clampedCompressionM) {
      const movingOutward = compressionM > 0 ? axialVelocity < 0 : axialVelocity > 0;
      if (movingOutward) axialVelocity = 0;
    }
    // 横方向: アンカーの横速度へ合わせ、位置のずれを0にする
    const lateralVelocity = 0;

    // 速度（位置の差分）を保ったまま位置だけをずらす（setPositionの既定動作）。
    Matter.Body.setPosition(this.wheel, {
      x: this.wheel.position.x + axis.x * axialShift - perp.x * lateral,
      y: this.wheel.position.y + axis.y * axialShift - perp.y * lateral,
    });
    Matter.Body.setVelocity(this.wheel, {
      x: anchorVelocity.x + axis.x * axialVelocity + perp.x * lateralVelocity,
      y: anchorVelocity.y + axis.y * axialVelocity + perp.y * lateralVelocity,
    });
  }
}
