import Matter from "matter-js";
import { describe, expect, it, vi } from "vitest";
import {
  drawBackground,
  drawDustParticles,
  drawGoalLine,
  drawStatusOverlays,
  drawSuspensionSpring,
  drawSuspensionSprings,
  drawVehicleSprite,
  getFullscreenWrapperStyle,
} from "./vehicleCanvasRendering";
import type { SuspensionAxle } from "../physics/suspension";
import type { DustParticle } from "../physics/impactEffects";

// CanvasRenderingContext2Dの全メソッド・プロパティ代入を記録するモック。
function createMockContext() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, name: string) => {
      if (name in target) return target[name];
      return (...args: unknown[]) => {
        calls.push(name);
        return args;
      };
    },
    set: (target, name: string, value) => {
      target[name] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const count = (name: string) => calls.filter((call) => call === name).length;
  return { ctx, calls, count };
}

const dust = (worldX: number): DustParticle => ({ worldX, worldY: 100, vx: 0, vy: 0, life: 12, maxLife: 24 });

describe("getFullscreenWrapperStyle", () => {
  it("待機中はスタイルなし、走行中は全画面固定になる", () => {
    expect(getFullscreenWrapperStyle(false)).toBeUndefined();
    expect(getFullscreenWrapperStyle(true)).toMatchObject({ position: "fixed", width: "100vw" });
  });
});

describe("drawBackground", () => {
  const scenery = [
    { kind: "tree" as const, worldX: 100 },
    { kind: "house" as const, worldX: 5000 },
  ];
  const parallaxLayers = [
    { speedFactor: 0.5, items: [{ kind: "mountain" as const, worldX: 200 }, { kind: "cloud" as const, worldX: 9000 }] },
  ];

  it("画面内の要素だけを描き、画面外の要素は描かない", () => {
    const { ctx, count } = createMockContext();
    drawBackground(ctx, parallaxLayers, scenery, 0, 800, 300);
    // 画面内の木(三角形1)＋山(2) のpathが描かれ、画面外の家・雲は描かれない
    expect(count("fill")).toBe(1 + 2);
    expect(count("ellipse")).toBe(0);
  });

  it("カメラ移動後は画面内に入った要素を描く", () => {
    const { ctx, count } = createMockContext();
    drawBackground(ctx, [], scenery, 4800, 800, 300);
    expect(count("fillRect")).toBeGreaterThan(0);
    expect(count("moveTo")).toBe(1); // 家の屋根のみ
  });

  it("雲を描く", () => {
    const { ctx, count } = createMockContext();
    drawBackground(ctx, [{ speedFactor: 1, items: [{ kind: "cloud", worldX: 100 }] }], [], 0, 800, 300);
    expect(count("ellipse")).toBe(3);
  });
});

describe("drawDustParticles", () => {
  it("画面外のパーティクルは描かない", () => {
    const { ctx, count } = createMockContext();
    drawDustParticles(ctx, [dust(100), dust(5000)], 0, 800);
    expect(count("arc")).toBe(1);
  });
});

describe("drawSuspensionSpring / drawSuspensionSprings", () => {
  it("長さがほぼ0のバネは描かない", () => {
    const { ctx, calls } = createMockContext();
    drawSuspensionSpring(ctx, 10, 10, 10.2, 10.2);
    expect(calls).toHaveLength(0);
  });

  it("コイルを折れ線で描く", () => {
    const { ctx, count } = createMockContext();
    drawSuspensionSpring(ctx, 0, 0, 0, 60);
    expect(count("lineTo")).toBe(6); // コイル5点＋終点
    expect(count("stroke")).toBe(1);
  });

  it("前後2本のバネを描く", () => {
    const axle = (x: number) =>
      ({ getSpringEnds: () => ({ top: { x, y: 0 }, bottom: { x, y: 60 } }) }) as unknown as SuspensionAxle;
    const { ctx, count } = createMockContext();
    drawSuspensionSprings(ctx, axle(0), axle(40), 0);
    expect(count("stroke")).toBe(2);
  });
});

describe("drawGoalLine", () => {
  it("ポールと旗を描く", () => {
    const { ctx, count } = createMockContext();
    drawGoalLine(ctx, 100, 300);
    expect(count("fillRect")).toBe(1);
    expect(count("fill")).toBe(1);
  });
});

describe("drawVehicleSprite", () => {
  const frontWheel = Matter.Bodies.circle(150, 280, 20);
  const rearWheel = Matter.Bodies.circle(50, 280, 20);
  const chassis = Matter.Bodies.rectangle(100, 250, 100, 30);
  const params = { frontWheel, rearWheel, chassis, wheelbasePx: 100, wheelRadiusPx: 20, animationTickCount: 17, offsetX: 0 };

  it("画像が未読み込みなら何も描かない", () => {
    const { ctx, calls } = createMockContext();
    drawVehicleSprite(ctx, { ...params, sprite: { complete: false, naturalWidth: 0 } as HTMLImageElement });
    expect(calls).toHaveLength(0);
  });

  it("読み込み済みならスプライトの該当フレームを描く", () => {
    const { ctx, count } = createMockContext();
    const drawImage = vi.fn();
    (ctx as unknown as Record<string, unknown>).drawImage = drawImage;
    drawVehicleSprite(ctx, { ...params, sprite: { complete: true, naturalWidth: 600 } as HTMLImageElement });
    expect(drawImage).toHaveBeenCalledTimes(1);
    // 17tick / 5tick毎 = フレーム3 → ソースY = 3 * 404
    expect(drawImage.mock.calls[0][2]).toBe(3 * 404);
    expect(count("restore")).toBe(1);
  });
});

describe("drawStatusOverlays", () => {
  it("通常時は何も描かない", () => {
    const { ctx, calls } = createMockContext();
    drawStatusOverlays(ctx, 800, 400, false, false);
    expect(calls).toHaveLength(0);
  });

  it("底付き中は赤いフラッシュを描く", () => {
    const { ctx, count } = createMockContext();
    drawStatusOverlays(ctx, 800, 400, true, false);
    expect(count("fillRect")).toBe(1);
    expect(count("fillText")).toBe(0);
  });

  it("ゴール到達後は「ゴール！」を描く", () => {
    const { ctx, count } = createMockContext();
    drawStatusOverlays(ctx, 800, 400, false, true);
    expect(count("fillText")).toBe(1);
  });
});
