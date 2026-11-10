import Matter from "matter-js";

/**
 * タイヤが地面パーツと接触しているかどうかを衝突イベントで追跡する。1本のタイヤが複数の
 * 地面パーツ（バンプの継ぎ目等）に同時接触することがあるため、単純なbooleanではなく
 * 接触ペア数をカウントし、0より大きい間は接地とみなす。非接地→接地への遷移（着地の瞬間）を
 * `onLanding`で通知する。
 */
export class WheelContactTracker {
  frontWheelContactCount = 0;
  rearWheelContactCount = 0;

  private readonly groundBodySet: Set<Matter.Body>;
  private readonly frontWheel: Matter.Body;
  private readonly rearWheel: Matter.Body;
  private readonly onLanding: (wheel: Matter.Body) => void;

  constructor(
    terrainBodies: Matter.Body[],
    frontWheel: Matter.Body,
    rearWheel: Matter.Body,
    onLanding: (wheel: Matter.Body) => void
  ) {
    this.groundBodySet = new Set(terrainBodies);
    this.frontWheel = frontWheel;
    this.rearWheel = rearWheel;
    this.onLanding = onLanding;
  }

  private isWheelGroundPair(pair: Matter.Pair, wheel: Matter.Body): boolean {
    if (pair.bodyA === wheel) return this.groundBodySet.has(pair.bodyB);
    if (pair.bodyB === wheel) return this.groundBodySet.has(pair.bodyA);
    return false;
  }

  handleCollisionStart = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      if (this.isWheelGroundPair(pair, this.frontWheel)) {
        if (this.frontWheelContactCount === 0) this.onLanding(this.frontWheel);
        this.frontWheelContactCount += 1;
      }
      if (this.isWheelGroundPair(pair, this.rearWheel)) {
        if (this.rearWheelContactCount === 0) this.onLanding(this.rearWheel);
        this.rearWheelContactCount += 1;
      }
    }
  };

  handleCollisionEnd = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      if (this.isWheelGroundPair(pair, this.frontWheel)) {
        this.frontWheelContactCount = Math.max(0, this.frontWheelContactCount - 1);
      }
      if (this.isWheelGroundPair(pair, this.rearWheel)) {
        this.rearWheelContactCount = Math.max(0, this.rearWheelContactCount - 1);
      }
    }
  };
}
