import type { VehicleConfig } from "../types/vehicle";

export interface VehiclePreset {
  id: string;
  label: string;
  config: VehicleConfig;
}

// 各プリセットの数値は「軽自動車は軽くて柔らかい」「トラックは重くて硬く跳ねやすい」といった
// 直感的な違いが体感できることを優先した目安値であり、実車の実測値ではない。
export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: "sedan",
    label: "セダン（標準）",
    config: {
      body: { weightKg: 1200, frontWeightRatio: 0.55, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
      suspension: { springConstant: 30000, damperCoefficient: 3000, strokeLength: 0.15, rideHeight: 0.4 },
      tire: { diameter: 0.6, stiffness: 200000 },
    },
  },
  {
    id: "kei-car",
    label: "軽自動車",
    config: {
      body: { weightKg: 800, frontWeightRatio: 0.6, centerOfGravityHeight: 0.55, wheelbase: 2.2 },
      suspension: { springConstant: 18000, damperCoefficient: 1800, strokeLength: 0.15, rideHeight: 0.4 },
      tire: { diameter: 0.55, stiffness: 150000 },
    },
  },
  {
    id: "sports-car",
    label: "スポーツカー",
    config: {
      body: { weightKg: 1400, frontWeightRatio: 0.5, centerOfGravityHeight: 0.35, wheelbase: 2.6 },
      suspension: { springConstant: 60000, damperCoefficient: 6000, strokeLength: 0.1, rideHeight: 0.25 },
      tire: { diameter: 0.65, stiffness: 250000 },
    },
  },
  {
    id: "suv",
    label: "SUV",
    config: {
      body: { weightKg: 2200, frontWeightRatio: 0.5, centerOfGravityHeight: 0.7, wheelbase: 2.9 },
      suspension: { springConstant: 40000, damperCoefficient: 4500, strokeLength: 0.2, rideHeight: 0.55 },
      tire: { diameter: 0.75, stiffness: 220000 },
    },
  },
  {
    id: "truck",
    label: "トラック",
    config: {
      body: { weightKg: 8000, frontWeightRatio: 0.45, centerOfGravityHeight: 0.9, wheelbase: 4.2 },
      suspension: { springConstant: 90000, damperCoefficient: 5000, strokeLength: 0.25, rideHeight: 0.7 },
      tire: { diameter: 1, stiffness: 350000 },
    },
  },
];
