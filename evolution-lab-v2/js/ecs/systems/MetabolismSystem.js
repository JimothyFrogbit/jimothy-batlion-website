// ── Metabolism System ───────────────────────────────────────────────
// Drains energy each tick based on the critter's metabolism rate.
// High-metabolism critters need to eat more frequently.
// Critters with zero energy are marked for death.

import { EcsSystem } from '../engine.js';

export class MetabolismSystem extends EcsSystem {
  constructor() {
    super('Metabolism');
  }

  update(dt, world) {
    const [energyStore, ccStore] = world.getStores('Energy', 'CritterConfig');

    for (const [eid, energy] of energyStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      const cc = ccStore.get(eid);
      const rate = cc ? cc.metabolism : 1.0;
      energy.energy -= rate * 5 * dt;
    }
  }
}
