import Matter from "matter-js";
import { describe, expect, it, vi } from "vitest";
import { drawVehicle } from "./vehicleDrawing";
import { ARCH_RADIUS_RATIO, computeGroundClearancePx, computeVehicleLayout } from "./vehicleLayout";

const R = 20;

describe("computeVehicleLayout", () => {
  const layout = computeVehicleLayout(60, -40, R);

  it("ホイールハウスの頂点が、バネの取り付け位置（重心の高さ、y=0）になる", () => {
    expect(layout.archCenterY - layout.archRadius).toBeCloseTo(0, 10);
    expect(layout.archRadius).toBeCloseTo(R * ARCH_RADIUS_RATIO, 10);
  });

  it("アーチの中心x・車体の端は、前後の取り付け位置とタイヤ半径から決まる", () => {
    expect(layout.frontArchX).toBe(60);
    expect(layout.rearArchX).toBe(-40);
    expect(layout.bodyFrontX).toBeGreaterThan(60 + R * 0.5);
    expect(layout.bodyRearX).toBeLessThan(-40 - R * 0.5);
  });

  it("車体の底面はアーチの中心の高さで、上面はアーチ頂点より上にある", () => {
    expect(layout.floorY).toBe(layout.archCenterY);
    expect(layout.hullTopY).toBeLessThan(0);
    expect(layout.cabinTopY).toBeLessThan(layout.hullTopY);
  });

  it("ホイールベースが長いほど、車体も長い", () => {
    const longer = computeVehicleLayout(100, -80, R);
    expect(longer.bodyFrontX - longer.bodyRearX).toBeGreaterThan(layout.bodyFrontX - layout.bodyRearX);
  });

  it("タイヤが大きいほど、アーチも大きい", () => {
    expect(computeVehicleLayout(60, -40, 30).archRadius).toBeGreaterThan(layout.archRadius);
  });
});

describe("computeGroundClearancePx", () => {
  it("車高を上げるほど、地上高が増える", () => {
    expect(computeGroundClearancePx(60, R)).toBeGreaterThan(computeGroundClearancePx(6, R));
  });

  it("車高と地上高の差は、アーチ半径とタイヤ半径の差で一定になる", () => {
    expect(computeGroundClearancePx(40, R) - computeGroundClearancePx(10, R)).toBeCloseTo(30, 10);
    expect(40 - computeGroundClearancePx(40, R)).toBeCloseTo(R * (ARCH_RADIUS_RATIO - 1), 10);
  });
});

describe("drawVehicle", () => {
  function createContext() {
    const translate = vi.fn();
    const rotate = vi.fn();
    const arc = vi.fn();
    const noop = vi.fn();
    const ctx = {
      save: noop,
      restore: noop,
      translate,
      rotate,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      closePath: noop,
      fill: noop,
      stroke: noop,
      clip: noop,
      fillRect: noop,
      arc,
    } as unknown as CanvasRenderingContext2D;
    return { ctx, translate, rotate, arc };
  }

  const chassis = Matter.Bodies.rectangle(300, 200, 100, 20);
  const frontWheel = Matter.Bodies.circle(360, 230, R);
  const rearWheel = Matter.Bodies.circle(260, 240, R);
  Matter.Body.setAngle(chassis, 0.2);
  const params = { chassis, frontWheel, rearWheel, frontArmPx: 60, rearArmPx: -40, wheelRadiusPx: R, offsetX: 100 };

  it("車体は重心の位置と傾きで描き、タイヤは各タイヤの物理位置に描く", () => {
    const { ctx, translate, rotate } = createContext();
    drawVehicle(ctx, params);
    // 1回目: 車体（カメラのずれを引いた重心位置）、2・3回目: 後輪・前輪
    expect(translate.mock.calls[0]).toEqual([200, 200]);
    expect(rotate.mock.calls[0]).toEqual([0.2]);
    expect(translate.mock.calls[1]).toEqual([260 - 100, 240]);
    expect(translate.mock.calls[2]).toEqual([360 - 100, 230]);
  });

  it("前後のタイヤ高さが違っても、それぞれの位置に描かれる（平均の高さに置かない）", () => {
    const { ctx, translate } = createContext();
    drawVehicle(ctx, params);
    expect(translate.mock.calls[1][1]).not.toBe(translate.mock.calls[2][1]);
  });

  it("タイヤは物理の半径で描く", () => {
    const { ctx, arc } = createContext();
    drawVehicle(ctx, params);
    const radii = arc.mock.calls.map((call) => call[2] as number);
    expect(radii).toContain(R);
  });
});
