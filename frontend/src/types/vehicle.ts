export interface VehicleBodyParams {
  /** 車重(kg) */
  weightKg: number;
  /** 前輪への重量配分（0〜1、残りが後輪） */
  frontWeightRatio: number;
  /** 重心高さ(m) */
  centerOfGravityHeight: number;
  /** ホイールベース(m) */
  wheelbase: number;
}

export interface SuspensionParams {
  /** バネ定数(N/m) */
  springConstant: number;
  /** ダンパー減衰係数(N・s/m) */
  damperCoefficient: number;
  /** ストローク量(m) */
  strokeLength: number;
  /** 車高(m) */
  rideHeight: number;
}

export interface TireParams {
  /** タイヤ径(m) */
  diameter: number;
  /** タイヤ剛性(N/m) */
  stiffness: number;
}

export type TerrainType =
  | "flat"
  | "smallBump"
  | "largeBump"
  | "hugeSpeedBump"
  | "washboard"
  | "jumpRamp";

export interface TestConditions {
  /** 試験速度(m/s) */
  speed: number;
  /** 段差高さ(m) */
  bumpHeight: number;
  /** スロープ角度(度) */
  slopeAngle: number;
  /** 路面種類 */
  terrainType: TerrainType;
}

export interface VehicleConfig {
  body: VehicleBodyParams;
  suspension: SuspensionParams;
  tire: TireParams;
}

export interface SimulationMetrics {
  /** 車速(m/s) */
  speed: number;
  /** サスペンションストローク(m) */
  suspensionStroke: number;
  /** 上下G */
  verticalG: number;
  /** 最大衝撃 */
  maxImpact: number;
  /** 底付き（ストロークがstrokeLengthに達している）中かどうか */
  isBottomedOut: boolean;
  /** 底付きが発生した回数（累積、非底付き→底付きの遷移ごとに1回カウント） */
  bottomOutCount: number;
}
