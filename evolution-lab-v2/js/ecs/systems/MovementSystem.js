// ── Movement System ─────────────────────────────────────────────────
// Moves critters based on their speed and steering behaviour.
// Critters with high aggression seek food sources.
// Critters with low aggression wander randomly with a directional bias.

import { EcsSystem } from '../engine.js';
import { dist } from '../../utils.js';

export class MovementSystem extends EcsSystem {
  constructor() {
    super('Movement');
  }

  update(dt, world) {
    const [posStore, ccStore] = world.getStores('Position', 'CritterConfig');
    if (!posStore || !ccStore) return;

    for (const [eid, pos] of posStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      const cc = ccStore.get(eid);
      if (!cc) continue; // not a critter (e.g. food source)

      const speed = cc.speed * 60 * dt;
      pos.x += pos.vx * speed;
      pos.y += pos.vy * speed;

      // Wrap around screen edges (simple toroidal world for now)
      const W = 800, H = 600;
      if (pos.x < 0) pos.x += W;
      if (pos.x > W) pos.x -= W;
      if (pos.y < 0) pos.y += H;
      if (pos.y > H) pos.y -= H;

      // Decay velocity slightly each tick
      pos.vx *= 0.98;
      pos.vy *= 0.98;
    }
  }
}
