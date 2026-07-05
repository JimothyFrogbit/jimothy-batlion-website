// ── ParticleSystem ───────────────────────────────────────────────────
// ECS Phase 2: Updates visual particles (age, decay, gravity, fade).
//
// Component Requirements: ParticleState + Position
//
// Logic replicated from entity.js Particle.update():
//   x += vx * dt
//   y += vy * dt
//   vy += gravity * dt
//   life -= dt
//   if life <= 0: mark entity dead

import { EcsSystem } from '../engine.js';

export class ParticleSystem extends EcsSystem {
  constructor() {
    super('ParticleSystem');
  }

  update(dt, world) {
    const particleStore = world.getStore('ParticleState');
    const posStore = world.getStore('Position');
    if (!particleStore || !posStore) return;

    const toKill = [];

    for (const [eid, state] of particleStore.getAll()) {
      const pos = posStore.get(eid);
      if (!pos) continue;

      // ── Decay life ──
      state.life -= dt;

      // ── Apply gravity ──
      pos.vy += state.gravity * dt;

      // ── Alpha fade (normalised life) ──
      const lifeRatio = Math.max(0, state.life / state.maxLife);

      // ── Kill if expired ──
      if (state.life <= 0) {
        toKill.push(eid);
      }
    }

    // Remove dead particles from the world
    for (const eid of toKill) {
      world.destroyEntity(eid);
    }
  }
}
