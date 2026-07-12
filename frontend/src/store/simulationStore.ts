import { create } from "zustand";
import type {
  VehicleConfig,
  TestConditions,
  SimulationMetrics,
} from "../types/vehicle";

const DEFAULT_VEHICLE: VehicleConfig = {
  body: {
    weightKg: 1200,
    frontWeightRatio: 0.55,
    centerOfGravityHeight: 0.5,
    wheelbase: 2.5,
  },
  suspension: {
    springConstant: 30000,
    damperCoefficient: 3000,
    strokeLength: 0.15,
    rideHeight: 0.4,
  },
  tire: {
    diameter: 0.6,
    stiffness: 200000,
  },
};

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
  metricsHistory: SimulationMetrics[];
  setVehicle: (vehicle: Partial<VehicleConfig>) => void;
  setTestConditions: (conditions: Partial<TestConditions>) => void;
  setMetrics: (metrics: SimulationMetrics) => void;
  setRunning: (isRunning: boolean) => void;
  reset: () => void;
}

const INITIAL_METRICS: SimulationMetrics = {
  speed: 0,
  suspensionStroke: 0,
  verticalG: 0,
  maxImpact: 0,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  vehicle: DEFAULT_VEHICLE,
  testConditions: DEFAULT_TEST_CONDITIONS,
  metrics: INITIAL_METRICS,
  isRunning: false,
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
  setRunning: (isRunning) => set({ isRunning }),
  reset: () =>
    set({
      vehicle: DEFAULT_VEHICLE,
      testConditions: DEFAULT_TEST_CONDITIONS,
      metrics: INITIAL_METRICS,
      metricsHistory: [],
      isRunning: false,
    }),
}));
