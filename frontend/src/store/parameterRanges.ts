import { MOUNT_BASE_LENGTH_M, computeStaticState } from "../physics/vehicleGeometry";
import type { DriveType, TerrainType, TestConditions, VehicleConfig } from "../types/vehicle";

export interface ParameterRange {
  min: number;
  max: number;
  step: number;
}

/** 各数値パラメータの範囲。スライダーの属性と入力値の検証の両方がここを参照する */
export const PARAMETER_RANGES = {
  weightKg: { min: 500, max: 30000, step: 50 },
  frontWeightRatio: { min: 0.3, max: 0.7, step: 0.01 },
  centerOfGravityHeight: { min: 0.2, max: 1.5, step: 0.05 },
  wheelbase: { min: 1.8, max: 5.0, step: 0.1 },
  springConstant: { min: 5000, max: 300000, step: 1000 },
  damperCoefficient: { min: 100, max: 20000, step: 100 },
  strokeLength: { min: 0.05, max: 0.4, step: 0.01 },
  mountHeight: { min: 0, max: 0.5, step: 0.01 },
  diameter: { min: 0.4, max: 1.2, step: 0.05 },
  stiffness: { min: 100000, max: 400000, step: 10000 },
  speed: { min: 5, max: 30, step: 1 },
} as const satisfies Record<string, ParameterRange>;

export const DRIVE_TYPES: readonly DriveType[] = ["awd", "ff", "fr"];

export const TERRAIN_TYPES: readonly TerrainType[] = [
  "flat",
  "smallBump",
  "largeBump",
  "hugeSpeedBump",
  "washboard",
  "jumpRamp",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 有限な数値でなければfallback、範囲外はmin・maxへ丸める */
function clampNumber(value: unknown, range: ParameterRange, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

type NumberFields<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T] & keyof typeof PARAMETER_RANGES;

function sanitizeGroup<T extends object>(input: unknown, fallback: T, keys: readonly NumberFields<T>[]): T {
  const source = asRecord(input);
  const result = { ...fallback };
  for (const key of keys) {
    (result as Record<string, number>)[key] = clampNumber(
      source[key],
      PARAMETER_RANGES[key],
      fallback[key] as number
    );
  }
  return result;
}

/** 任意の値をVehicleConfigへ整える。不正な項目はfallbackの値、範囲外は範囲内へ丸め、未知のキーは捨てる */
export function sanitizeVehicleConfig(input: unknown, fallback: VehicleConfig): VehicleConfig {
  const source = asRecord(input);
  // 駆動方式は3種以外・未指定ならfallback（古い共有URLには含まれないため、既定の駆動方式で読める）。
  const driveType = DRIVE_TYPES.find((candidate) => candidate === asRecord(source.body).driveType) ?? fallback.body.driveType;
  const config: VehicleConfig = {
    body: {
      ...sanitizeGroup(source.body, fallback.body, ["weightKg", "frontWeightRatio", "centerOfGravityHeight", "wheelbase"]),
      driveType,
    },
    suspension: sanitizeGroup(source.suspension, fallback.suspension, [
      "springConstant",
      "damperCoefficient",
      "strokeLength",
      "mountHeight",
    ]),
    tire: sanitizeGroup(source.tire, fallback.tire, ["diameter", "stiffness"]),
  };
  return convertLegacyRideHeight(config, asRecord(source.suspension));
}

/**
 * 古い共有URLは、バネ取り付け位置（mountHeight）ではなく、車高（rideHeight）を持つ（issue #557）。
 * mountHeightが無く、rideHeightがあるときは、同じ釣り合いの車高になる取り付け位置へ換算する
 * （取り付け位置 = 旧車高 + 静止時のたわみ − 基準の自由長）。範囲外は範囲内へ丸める。
 */
function convertLegacyRideHeight(config: VehicleConfig, suspensionSource: Record<string, unknown>): VehicleConfig {
  const { rideHeight, mountHeight } = suspensionSource;
  const hasMountHeight = typeof mountHeight === "number" && Number.isFinite(mountHeight);
  if (hasMountHeight || typeof rideHeight !== "number" || !Number.isFinite(rideHeight)) return config;

  const { sagFrontM, sagRearM } = computeStaticState(config);
  const converted = rideHeight + (sagFrontM + sagRearM) / 2 - MOUNT_BASE_LENGTH_M;
  const range = PARAMETER_RANGES.mountHeight;
  const clamped = Math.min(range.max, Math.max(range.min, Math.round(converted * 100) / 100));
  return { ...config, suspension: { ...config.suspension, mountHeight: clamped } };
}

/** 任意の値をTestConditionsへ整える（VehicleConfigと同じ規則。terrainTypeは6種以外ならfallback） */
export function sanitizeTestConditions(input: unknown, fallback: TestConditions): TestConditions {
  const source = asRecord(input);
  const terrainType = TERRAIN_TYPES.find((candidate) => candidate === source.terrainType) ?? fallback.terrainType;
  return {
    ...sanitizeGroup(source, fallback, ["speed"]),
    terrainType,
  };
}
