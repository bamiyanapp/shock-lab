import Matter from "matter-js";

export function createWorld(): Matter.Engine {
  const engine = Matter.Engine.create();
  engine.gravity.y = 1;
  return engine;
}
