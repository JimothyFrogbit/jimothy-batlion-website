// ── Death System ────────────────────────────────────────────────────
// Marks entities with zero energy or expired age for reaping.
// Uses Energy.energy <= 0 as the primary death signal.
// AgeSystem handles maxAge deaths separately.

import { EcsSystem } from '../engine.js';

export class DeathSystem extends EcsSystem {
  constructor() {
    super('Death');
  }

  update(dt, world) {
    const energyStore = world.getStore('Energy');
    if (!energyStore) return;

    for (const [eid, energy] of energyStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      if (energy.energy <= 0) {
        world.markDead(eid);
      }
    }
  }
}
