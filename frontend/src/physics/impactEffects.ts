export interface DustParticle {
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  /** 残りtick数。0以下で消滅する */
  life: number;
  maxLife: number;
}

const PARTICLE_MAX_LIFE_TICKS = 24;

/**
 * 着地・走行中の砂埃パーティクルをタイヤ接地点まわりに生成する。
 * Math.random()を直接使わず、呼び出し側から乱数源（randomFn）を注入できるようにして
 * 単体テストで決定的な検証ができるようにしている。
 */
export function spawnDustBurst(
  worldX: number,
  worldY: number,
  count: number,
  randomFn: () => number = Math.random
): DustParticle[] {
  const particles: DustParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI + (randomFn() - 0.5) * Math.PI;
    const speed = 0.5 + randomFn() * 1.5;
    particles.push({
      worldX,
      worldY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: PARTICLE_MAX_LIFE_TICKS,
      maxLife: PARTICLE_MAX_LIFE_TICKS,
    });
  }
  return particles;
}

/** 1tickぶんパーティクルを移動・減衰させ、寿命が尽きたものを取り除く */
export function advanceDustParticles(particles: DustParticle[]): DustParticle[] {
  return particles
    .map((particle) => ({
      ...particle,
      worldX: particle.worldX + particle.vx,
      worldY: particle.worldY + particle.vy,
      vy: particle.vy + 0.05, // 重力で徐々に落下させる
      life: particle.life - 1,
    }))
    .filter((particle) => particle.life > 0);
}
