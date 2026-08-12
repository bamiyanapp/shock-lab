import { create } from "zustand";
import type {
  VehicleConfig,
  TestConditions,
  SimulationMetrics,
} from "../types/vehicle";
import { VEHICLE_PRESETS } from "./vehiclePresets";

const DEFAULT_VEHICLE: VehicleConfig = VEHICLE_PRESETS[0].config;

const DEFAULT_TEST_CONDITIONS: TestConditions = {
  speed: 10,
  bumpHeight: 0.1,
  slopeAngle: 0,
  terrainType: "smallBump",
};

interface SimulationState {
  vehicle: VehicleConfig;
  testConditions: TestConditions;
  metrics: SimulationMetrics;
  isRunning: boolean;
  /** 一度でも開始ボタンが押されたかどうか。一時停止後に「開始」ではなく「再開/最初から」を出し分けるために使う */
  hasStarted: boolean;
  /** インクリメントするとVehicleCanvas側のシミュレーション世界が再構築され、車体位置が最初からになる */
  runToken: number;
  metricsHistory: SimulationMetrics[];
  setVehicle: (vehicle: Partial<VehicleConfig>) => void;
  setTestConditions: (conditions: Partial<TestConditions>) => void;
  setMetrics: (metrics: SimulationMetrics) => void;
  setRunning: (isRunning: boolean) => void;
  /** 車体位置・履歴を最初の状態へ戻し、そのまま走行を再開する（車両パラメータは維持する） */
  restartRun: () => void;
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

export const useSimulationStore = create<SimulationState>((set) => ({
  vehicle: DEFAULT_VEHICLE,
  testConditions: DEFAULT_TEST_CONDITIONS,
  metrics: INITIAL_METRICS,
  isRunning: false,
  hasStarted: false,
  runToken: 0,
  metricsHistory: [],
  setVehicle: (vehicle) =>
    set((state) => ({
      vehicle: {
        body: { ...state.vehicle.body, ...vehicle.body },
        suspension: { ...state.vehicle.suspension, ...vehicle.suspension },
        tire: { ...state.vehicle.tire, ...vehicle.tire },
      },
    })),
  setTestConditions: (conditions) =>
    set((state) => ({ testConditions: { ...state.testConditions, ...conditions } })),
  setMetrics: (metrics) =>
    set((state) => ({
      metrics,
      metricsHistory: [...state.metricsHistory, metrics].slice(-200),
    })),
  setRunning: (isRunning) =>
    set((state) => ({ isRunning, hasStarted: state.hasStarted || isRunning })),
  restartRun: () =>
    set((state) => ({
      runToken: state.runToken + 1,
      isRunning: true,
      hasStarted: true,
      metrics: INITIAL_METRICS,
      metricsHistory: [],
    })),
  reset: () =>
    set({
      vehicle: DEFAULT_VEHICLE,
      testConditions: DEFAULT_TEST_CONDITIONS,
      metrics: INITIAL_METRICS,
      metricsHistory: [],
      isRunning: false,
      hasStarted: false,
      runToken: 0,
    }),
}));
