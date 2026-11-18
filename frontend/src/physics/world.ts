import Matter from "matter-js";
import { GRAVITY_SCALE } from "./units";

export function createWorld(): Matter.Engine {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1;
  // 実効重力を9.8m/s²にする（詳細はunits.tsのGRAVITY_SCALE参照）。
  engine.gravity.scale = GRAVITY_SCALE;
  return engine;
}
