import { BOTTOM_OUT_ENTER_RATIO } from "./metrics";
import { GRAVITY_MS2, PIXELS_PER_METER, UNSPRUNG_MASS_KG } from "./units";
import type { VehicleBodyParams, VehicleConfig } from "../types/vehicle";

/**
 * バネの自由長（荷重ゼロでの長さ）の基準。自由長 = この値 + バネ取り付け位置 + ストローク量。
 * ストローク量が大きいバネは長く、車高が上がる（issue #557・#569）。
 * 取り付け位置0〜0.5m・ストローク0.05〜0.40mなので、自由長は0.10〜0.95mになる。
 */
export const FREE_LENGTH_BASE_M = 0.05;

// スライダー値は1輪あたり。2Dの1軸は左右2輪ぶんなので2倍する（suspension.tsと同じ）。
const WHEELS_PER_AXLE = 2;

/** ばね上質量(kg)。車重から前後2軸ぶんのばね下質量を引いた値 */
export function getSprungMassKg(weightKg: number): number {
  return Math.max(1, weightKg - 2 * UNSPRUNG_MASS_KG);
}

/** 車体の重心から前軸・後軸までの水平距離(px)。前重心ほど前軸に近くなる */
export function getAxleArmsPx(body: VehicleBodyParams): { front: number; rear: number } {
  const wheelbasePx = body.wheelbase * PIXELS_PER_METER;
  return { front: wheelbasePx * (1 - body.frontWeightRatio), rear: wheelbasePx * body.frontWeightRatio };
}

/** バネの自由長(m)。取り付け位置とストローク量から決まる */
export function computeFreeLengthM(mountHeightM: number, strokeM: number): number {
  return FREE_LENGTH_BASE_M + mountHeightM + strokeM;
}

export interface StaticState {
  /** バネの自由長(m) */
  freeLengthM: number;
  /** 静止時のたわみ(m)。前軸・後軸 */
  sagFrontM: number;
  sagRearM: number;
  /** 釣り合いの位置での、取り付け点からタイヤ中心までの距離(m)。前軸・後軸 */
  heightFrontM: number;
  heightRearM: number;
  /** 実際の車高(m)。前後の平均 */
  rideHeightM: number;
  /** 静止時のたわみが、ストロークを使い切っている（初めから底付きで、走れない） */
  isBottomedOutAtStart: boolean;
}

/**
 * 静止状態（走り出す前）の、バネのたわみと実際の車高を求める純粋関数（issue #557）。
 * たわみ = ばね上質量（その軸が支える分）× 重力 ÷ (2 × バネ定数)。実際の車高 = 自由長 − たわみ。
 * たわみがストロークの98%以上（底付きの入口と同じ割合）になる軸があれば、初めから底付きになる。
 */
export function computeStaticState(vehicle: VehicleConfig): StaticState {
  const { body, suspension } = vehicle;
  const sprungMassKg = getSprungMassKg(body.weightKg);
  const springN = WHEELS_PER_AXLE * suspension.springConstant;
  const freeLengthM = computeFreeLengthM(suspension.mountHeight, suspension.strokeLength);
  const sagFrontM = (sprungMassKg * body.frontWeightRatio * GRAVITY_MS2) / springN;
  const sagRearM = (sprungMassKg * (1 - body.frontWeightRatio) * GRAVITY_MS2) / springN;
  const heightFrontM = freeLengthM - sagFrontM;
  const heightRearM = freeLengthM - sagRearM;
  const maxSagM = Math.max(sagFrontM, sagRearM);
  return {
    freeLengthM,
    sagFrontM,
    sagRearM,
    heightFrontM,
    heightRearM,
    rideHeightM: (heightFrontM + heightRearM) / 2,
    isBottomedOutAtStart: maxSagM >= suspension.strokeLength * BOTTOM_OUT_ENTER_RATIO,
  };
}

/**
 * 前後の取り付け点の、車体の重心からの縦のずれ(px。車体の下向きが正)。
 * 前後でたわみが違うため（荷重の配分が違う）、取り付け点が同じ高さだと、釣り合いの位置で車体が
 * 傾く。傾くと、バネの力に水平の成分が生まれ、車体が勝手に前後へ押される。それを避けるため、
 * 車体を水平に保ち、たわみの差を、取り付け点の高さの差として吸収する（issue #557）。
 */
export function computeAnchorOffsetsPx(state: StaticState): { front: number; rear: number } {
  const averageHeightM = state.rideHeightM;
  return {
    front: (averageHeightM - state.heightFrontM) * PIXELS_PER_METER,
    rear: (averageHeightM - state.heightRearM) * PIXELS_PER_METER,
  };
}
