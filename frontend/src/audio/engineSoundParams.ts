import { VEHICLE_PRESETS } from "../store/vehiclePresets";
import type { VehicleConfig } from "../types/vehicle";

// エンジン音の「パラメータの計算」を、Web Audioから切り離した純粋関数にする（issue #511）。
// 聴感は自動テストできないが、速度→回転数→各パラメータの対応は、単体テストで確かめられる。

/** 車種ごとのエンジン音の特徴 */
export interface EngineSoundProfile {
  idleRpm: number;
  redlineRpm: number;
  /** 1回転あたりの点火回数（4ストロークは、気筒数 ÷ 2） */
  firingPerRev: number;
  /** 各ギアで出せる最高速度(m/s)。ギアが上がると、回転数がいったん落ちる */
  gearTopSpeedsMps: readonly number[];
  /** 基音（点火周波数の2・3・4倍）の音量の比 */
  harmonicGains: readonly [number, number, number];
  /** ローパスフィルタのカットオフ = 基準 + 回転数 × 係数 */
  cutoffBaseHz: number;
  cutoffPerRpm: number;
  /** ざらつき（ノイズ）の基準の量と、速度による増え方（0〜1） */
  noiseBase: number;
  noiseSpeedGain: number;
}

/** 基音として重ねる、点火周波数の倍数。小さなスピーカーでも聞こえるよう、2〜4倍にする */
export const HARMONIC_ORDERS = [2, 3, 4] as const;
/** この速度(m/s)以上は、ロードノイズが頭打ちになる */
const NOISE_SPEED_CAP_MPS = 40;
/** 上のギアへ入った直後の回転数の、レッドラインに対する割合 */
const UPSHIFT_RPM_RATIO = 0.45;
/** ギアの上限に近づいたときの回転数の、レッドラインに対する割合 */
const GEAR_TOP_RPM_RATIO = 0.92;
/** 上下Gによる、ノイズの増え方 */
const ROUGHNESS_NOISE_GAIN = 0.5;

const SEDAN_PROFILE: EngineSoundProfile = {
  idleRpm: 800,
  redlineRpm: 6000,
  firingPerRev: 2,
  gearTopSpeedsMps: [6, 11, 17, 24, 32, 45],
  harmonicGains: [1, 0.55, 0.3],
  cutoffBaseHz: 500,
  cutoffPerRpm: 0.5,
  noiseBase: 0.04,
  noiseSpeedGain: 0.25,
};

/** プリセットのIDごとの、エンジン音の特徴。トラックは低く重く、スポーツカーは高く鋭い */
export const ENGINE_PROFILES: Record<string, EngineSoundProfile> = {
  sedan: SEDAN_PROFILE,
  "kei-car": {
    idleRpm: 900,
    redlineRpm: 7000,
    firingPerRev: 1.5,
    gearTopSpeedsMps: [5, 9, 14, 20, 27, 38],
    harmonicGains: [1, 0.4, 0.2],
    cutoffBaseHz: 600,
    cutoffPerRpm: 0.45,
    noiseBase: 0.05,
    noiseSpeedGain: 0.3,
  },
  "sports-car": {
    idleRpm: 900,
    redlineRpm: 8000,
    firingPerRev: 3,
    gearTopSpeedsMps: [7, 12, 19, 27, 36, 50],
    harmonicGains: [1, 0.7, 0.5],
    cutoffBaseHz: 800,
    cutoffPerRpm: 0.6,
    noiseBase: 0.03,
    noiseSpeedGain: 0.2,
  },
  suv: {
    idleRpm: 700,
    redlineRpm: 5500,
    firingPerRev: 3,
    gearTopSpeedsMps: [6, 10, 16, 23, 30, 42],
    harmonicGains: [1, 0.6, 0.35],
    cutoffBaseHz: 450,
    cutoffPerRpm: 0.45,
    noiseBase: 0.05,
    noiseSpeedGain: 0.3,
  },
  truck: {
    idleRpm: 600,
    redlineRpm: 3500,
    firingPerRev: 2,
    gearTopSpeedsMps: [4, 8, 12, 17, 23, 32],
    harmonicGains: [1, 0.8, 0.5],
    cutoffBaseHz: 350,
    cutoffPerRpm: 0.4,
    noiseBase: 0.07,
    noiseSpeedGain: 0.4,
  },
};

/**
 * 車両の設定から、エンジン音の特徴を選ぶ。プリセットと全項目が一致すれば、そのプリセットの特徴を、
 * 一致しなければ（カスタム）、車重に近いプリセットの特徴を使う。
 */
export function selectEngineProfile(vehicle: VehicleConfig): EngineSoundProfile {
  const serialized = JSON.stringify(vehicle);
  const exact = VEHICLE_PRESETS.find((preset) => JSON.stringify(preset.config) === serialized);
  if (exact) return ENGINE_PROFILES[exact.id] ?? SEDAN_PROFILE;
  const nearest = VEHICLE_PRESETS.reduce((best, preset) =>
    Math.abs(preset.config.body.weightKg - vehicle.body.weightKg) < Math.abs(best.config.body.weightKg - vehicle.body.weightKg)
      ? preset
      : best
  );
  return ENGINE_PROFILES[nearest.id] ?? SEDAN_PROFILE;
}

export interface EngineSoundParams {
  rpm: number;
  /** 1から始まるギア段 */
  gear: number;
  /** 点火周波数(Hz) = 回転数 ÷ 60 × 1回転あたりの点火回数 */
  firingHz: number;
  /** 基音のオシレータの周波数(Hz)。点火周波数の2・3・4倍 */
  oscillatorHz: readonly [number, number, number];
  harmonicGains: readonly [number, number, number];
  /** ローパスフィルタのカットオフ(Hz)。回転数に連動し、耳に痛い高音を抑える */
  cutoffHz: number;
  /** ざらつき（ノイズ）の量（0〜1）。速度で増え、揺れが大きいと、一瞬強くなる */
  noiseGain: number;
  /** ノイズを通すバンドパスフィルタの中心(Hz)。速度が上がると、高くなる */
  noiseBandHz: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 速度から、ギア段（0から）と、そのギアの中での位置（0〜1）を求める */
function locateInGear(speedMps: number, tops: readonly number[]): { gearIndex: number; position: number } {
  const found = tops.findIndex((top) => speedMps <= top);
  const gearIndex = found === -1 ? tops.length - 1 : found;
  const lower = gearIndex === 0 ? 0 : tops[gearIndex - 1];
  const span = tops[gearIndex] - lower;
  return { gearIndex, position: clamp((speedMps - lower) / span, 0, 1) };
}

/**
 * 走行速度(m/s)・車種の特徴・揺れ（上下Gの絶対値）から、エンジン音のパラメータを求める純粋関数。
 * 速度から、疑似的なギア段と回転数を決める。上のギアへ入ると、回転数がいったん落ちる。
 */
export function computeEngineSoundParams(
  speedMps: number,
  profile: EngineSoundProfile,
  roughnessG = 0
): EngineSoundParams {
  const speed = Math.abs(speedMps);
  const { gearIndex, position } = locateInGear(speed, profile.gearTopSpeedsMps);
  const isLastGear = gearIndex === profile.gearTopSpeedsMps.length - 1;
  const rpmLow = gearIndex === 0 ? profile.idleRpm : profile.redlineRpm * UPSHIFT_RPM_RATIO;
  const rpmHigh = profile.redlineRpm * (isLastGear ? 1 : GEAR_TOP_RPM_RATIO);
  const rpm = rpmLow + (rpmHigh - rpmLow) * position;

  const firingHz = (rpm / 60) * profile.firingPerRev;
  const [o1, o2, o3] = HARMONIC_ORDERS;
  const noise =
    profile.noiseBase +
    profile.noiseSpeedGain * (Math.min(speed, NOISE_SPEED_CAP_MPS) / NOISE_SPEED_CAP_MPS) +
    Math.abs(roughnessG) * ROUGHNESS_NOISE_GAIN;
  return {
    rpm,
    gear: gearIndex + 1,
    firingHz,
    oscillatorHz: [firingHz * o1, firingHz * o2, firingHz * o3],
    harmonicGains: profile.harmonicGains,
    cutoffHz: clamp(profile.cutoffBaseHz + rpm * profile.cutoffPerRpm, 300, 6000),
    noiseGain: clamp(noise, 0, 1),
    noiseBandHz: 600 + Math.min(speed, NOISE_SPEED_CAP_MPS) * 40,
  };
}
