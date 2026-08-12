import { describe, expect, it } from "vitest";
import { spawnDustBurst, advanceDustParticles } from "./impactEffects";

describe("spawnDustBurst", () => {
  it("creates the requested number of particles at the given world position", () => {
    const particles = spawnDustBurst(100, 200, 5, () => 0.5);
    expect(particles).toHaveLength(5);
    for (const particle of particles) {
      expect(particle.worldX).toBe(100);
      expect(particle.worldY).toBe(200);
      expect(particle.life).toBeGreaterThan(0);
    }
  });

  it("is deterministic for a fixed random function", () => {
    const a = spawnDustBurst(0, 0, 3, () => 0.3);
    const b = spawnDustBurst(0, 0, 3, () => 0.3);
    expect(a).toEqual(b);
  });
});

describe("advanceDustParticles", () => {
  it("moves particles by their velocity and decrements life", () => {
    const [particle] = spawnDustBurst(0, 0, 1, () => 0.5);
    const [advanced] = advanceDustParticles([particle]);

    expect(advanced.worldX).toBeCloseTo(particle.worldX + particle.vx, 10);
    expect(advanced.life).toBe(particle.life - 1);
  });

  it("removes particles whose life has reached zero", () => {
    const particle = { worldX: 0, worldY: 0, vx: 0, vy: 0, life: 1, maxLife: 24 };
    expect(advanceDustParticles([particle])).toEqual([]);
  });

  it("applies gravity by increasing vy over time", () => {
    const particle = { worldX: 0, worldY: 0, vx: 0, vy: 0, life: 5, maxLife: 24 };
    const [advanced] = advanceDustParticles([particle]);
    expect(advanced.vy).toBeGreaterThan(particle.vy);
  });
});
