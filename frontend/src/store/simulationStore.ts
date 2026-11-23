import { computeStaticState } from "../physics/vehicleGeometry";
import { create } from "zustand";
import type {
  HistorySample,
  VehicleConfig,
  TestConditions,
  SimulationMetrics,
} from "../types/vehicle";
import { VEHICLE_PRESETS } from "./vehiclePresets";
import { MAX_HISTORY_SAMPLES } from "../physics/units";
import { sanitizeTestConditions, sanitizeVehicleConfig } from "./parameterRanges";
import type { ResultRank, ResultStats } from "../physics/resultRank";

/** 走行の状態。idle=未開始、running=走行中、paused=一時停止、finished=ゴールまたはリタイアで終了 */
export type RunPhase = "idle" | "running" | "paused" | "finished";

/** リタイアの理由。overturned=転倒、stuck=走行不能、fellOff=コースアウト、timeout=時間切れ */
export type RetireReason = "overturned" | "stuck" | "fellOff" | "timeout";

/** 走行の終了時（ゴールまたはリタイア）にVehicleCanvasが集計し、ストアへ書き込むリザルト情報 */
export interface SimulationResult extends ResultStats {
  outcome: "goal" | "retire";
  /** リタイアの理由。outcomeがretireのときのみ設定する */
  retireReason?: RetireReason;
  /** ランク。リタイア時は判定しないためnull */
  rank: ResultRank | null;
  /** 走行時間(秒)。ランク判定には使わない参考値（詳細はphysics/resultRank.ts参照） */
  elapsedSeconds: number;
  /** スタート地点からの到達距離(m) */
  distanceMeters: number;
}

export const DEFAULT_VEHICLE: VehicleConfig = VEHICLE_PRESETS[0].config;

export const DEFAULT_TEST_CONDITIONS: TestConditions = {
  speed: 10,
  terrainType: "smallBump",
};

interface SimulationState {
  vehicle: VehicleConfig;
  testConditions: TestConditions;
  metrics: SimulationMetrics;
  phase: RunPhase;
  /** インクリメントするとVehicleCanvas側のシミュレーション世界が再構築され、車体位置が最初からになる */
  runToken: number;
  /** グラフ用の履歴（10Hz・最大3000サンプル）。走行距離で並ぶ */
  metricsHistory: HistorySample[];
  /** ゴール到達時のリザルト。未到達・リスタート後はnull */
  result: SimulationResult | null;
  /** true時はクリック音・衝撃音・エンジン音等すべてのサウンドフィードバックを無音にする（issue #53） */
  isMuted: boolean;
  setVehicle: (vehicle: Partial<VehicleConfig>) => void;
  setTestConditions: (conditions: Partial<TestConditions>) => void;
  /** 現在値と履歴の1サンプルを反映する（10Hzで呼ぶ）。サンプルが無ければ現在値のみ */
  setMetrics: (metrics: SimulationMetrics, sample?: HistorySample | null) => void;
  /** idle → running */
  startRun: () => void;
  /** running → paused（一時停止・閉じるボタン・バックグラウンド化） */
  pauseRun: () => void;
  /** paused → running */
  resumeRun: () => void;
  /** running → finished（ゴールまたはリタイア。resultを設定する） */
  finishRun: (result: SimulationResult) => void;
  /** 車体位置・履歴を最初の状態へ戻し、そのまま走行を再開する（車両パラメータは維持する） */
  restartRun: () => void;
  setMuted: (isMuted: boolean) => void;
  reset: () => void;
}

const INITIAL_METRICS: SimulationMetrics = {
  speed: 0,
  suspensionStroke: 0,
  rearSuspensionStroke: 0,
  verticalG: 0,
  maxImpact: 0,
  isBottomedOut: false,
  bottomOutCount: 0,
};

/** 設定を変えたときに、走行の状態を未開始へ戻す（ワールドを作り直させ、前の走行の値を残さない） */
function resetRunState(runToken: number) {
  return {
    phase: "idle" as const,
    runToken: runToken + 1,
    metrics: INITIAL_METRICS,
    metricsHistory: [],
    result: null,
  };
}

export const useSimulationStore = create<SimulationState>((set) => ({
  vehicle: DEFAULT_VEHICLE,
  testConditions: DEFAULT_TEST_CONDITIONS,
  metrics: INITIAL_METRICS,
  phase: "idle",
  runToken: 0,
  metricsHistory: [],
  result: null,
  isMuted: false,
  setVehicle: (vehicle) =>
    // マージ後の値を必ず検証してから保存する（入力欄・共有URL・プリセットの共通の入口）。
    set((state) => ({
      vehicle: sanitizeVehicleConfig(
        {
          body: { ...state.vehicle.body, ...vehicle.body },
          suspension: { ...state.vehicle.suspension, ...vehicle.suspension },
          tire: { ...state.vehicle.tire, ...vehicle.tire },
        },
        state.vehicle
      ),
      ...resetRunState(state.runToken),
    })),
  setTestConditions: (conditions) =>
    set((state) => ({
      testConditions: sanitizeTestConditions({ ...state.testConditions, ...conditions }, state.testConditions),
      ...resetRunState(state.runToken),
    })),
  setMetrics: (metrics, sample) =>
    set((state) => ({
      metrics,
      metricsHistory: sample ? [...state.metricsHistory, sample].slice(-MAX_HISTORY_SAMPLES) : state.metricsHistory,
    })),
  // 初めから底付きになる設定（バネ定数が低い・車重が重い等）では、走れないため開始しない（issue #557）。
  startRun: () =>
    set((state) =>
      state.phase === "idle" && !computeStaticState(state.vehicle).isBottomedOutAtStart ? { phase: "running" } : {}
    ),
  pauseRun: () => set((state) => (state.phase === "running" ? { phase: "paused" } : {})),
  resumeRun: () => set((state) => (state.phase === "paused" ? { phase: "running" } : {})),
  finishRun: (result) => set((state) => (state.phase === "running" ? { phase: "finished", result } : {})),
  restartRun: () =>
    set((state) =>
      computeStaticState(state.vehicle).isBottomedOutAtStart
        ? { ...resetRunState(state.runToken) }
        : { ...resetRunState(state.runToken), phase: "running" }
    ),
  setMuted: (isMuted) => set({ isMuted }),
  reset: () =>
    set({
      vehicle: DEFAULT_VEHICLE,
      testConditions: DEFAULT_TEST_CONDITIONS,
      metrics: INITIAL_METRICS,
      metricsHistory: [],
      phase: "idle",
      runToken: 0,
      result: null,
    }),
}));
