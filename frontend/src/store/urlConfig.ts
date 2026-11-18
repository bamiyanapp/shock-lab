import type { VehicleConfig, TestConditions } from "../types/vehicle";
import { DEFAULT_TEST_CONDITIONS, DEFAULT_VEHICLE } from "./simulationStore";
import { sanitizeTestConditions, sanitizeVehicleConfig } from "./parameterRanges";

export const SHARED_CONFIG_QUERY_PARAM = "config";

export interface SharedConfig {
  vehicle: VehicleConfig;
  testConditions: TestConditions;
}

/**
 * VehicleConfig・TestConditionsをURLクエリパラメータへ埋め込める文字列にエンコードする。
 * JSON文字列をBase64化するだけの単純な方式で、リンクを開くだけで同じセッティングを
 * 再現できるようにする（サーバー側の保存は行わない）。
 */
export function encodeSharedConfig(vehicle: VehicleConfig, testConditions: TestConditions): string {
  const json = JSON.stringify({ vehicle, testConditions } satisfies SharedConfig);
  return btoa(encodeURIComponent(json));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * encodeSharedConfig()で生成した文字列をデコードする。
 * 不正な値（手動編集されたURL等）の場合はnullを返し、呼び出し側は既定値にフォールバックできる。
 */
export function decodeSharedConfig(value: string): SharedConfig | null {
  try {
    const json = decodeURIComponent(atob(value));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed) || !isRecord(parsed.vehicle) || !isRecord(parsed.testConditions)) {
      return null;
    }
    // 手動編集されたURLの欠落・範囲外・型違いの値を、既定値・範囲内の値へ整えて返す。
    return {
      vehicle: sanitizeVehicleConfig(parsed.vehicle, DEFAULT_VEHICLE),
      testConditions: sanitizeTestConditions(parsed.testConditions, DEFAULT_TEST_CONDITIONS),
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(vehicle: VehicleConfig, testConditions: TestConditions): string {
  const query = encodeSharedConfig(vehicle, testConditions);
  const url = new URL(window.location.href);
  url.search = `${SHARED_CONFIG_QUERY_PARAM}=${query}`;
  return url.toString();
}
