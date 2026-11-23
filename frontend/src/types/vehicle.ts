/** 駆動方式。awd=四駆（前後どちらか）、ff=前輪駆動、fr=後輪駆動 */
export type DriveType = "awd" | "ff" | "fr";

export interface VehicleBodyParams {
  /** 車重(kg) */
  weightKg: number;
  /** 前輪への重量配分（0〜1、残りが後輪） */
  frontWeightRatio: number;
  /** 重心高さ(m) */
  centerOfGravityHeight: number;
  /** ホイールベース(m) */
  wheelbase: number;
  /** 駆動方式。駆動輪が接地しているときだけ駆動力が働く */
  driveType: DriveType;
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
  /** 路面種類 */
  terrainType: TerrainType;
}

export interface VehicleConfig {
  body: VehicleBodyParams;
  suspension: SuspensionParams;
  tire: TireParams;
}

/** グラフ用の履歴の1サンプル（10Hz）。値は区間内（6tick）で絶対値が最大だったもの */
export interface HistorySample {
  /** 走行開始からの経過時間(秒) */
  timeSec: number;
  /** スタート地点からの走行距離(m) */
  distanceM: number;
  verticalG: number;
  frontStroke: number;
  rearStroke: number;
  /** 区間内に底付きがあったか */
  isBottomedOut: boolean;
}

export interface SimulationMetrics {
  /** 車速(m/s) */
  speed: number;
  /** フロントサスペンションストローク(m) */
  suspensionStroke: number;
  /** リアサスペンションストローク(m) */
  rearSuspensionStroke: number;
  /** 上下G */
  verticalG: number;
  /** 最大衝撃 */
  maxImpact: number;
  /** 底付き（ストロークがstrokeLengthに達している）中かどうか */
  isBottomedOut: boolean;
  /** 底付きが発生した回数（累積、非底付き→底付きの遷移ごとに1回カウント） */
  bottomOutCount: number;
}
