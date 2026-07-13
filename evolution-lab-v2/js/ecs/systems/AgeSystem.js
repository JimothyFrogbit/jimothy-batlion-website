// ── Age System ──────────────────────────────────────────────────────
// Increments age for all entities with an Age component.
// Entities that exceed their maxAge are marked for death.

import { EcsSystem } from '../engine.js';

export class AgeSystem extends EcsSystem {
  constructor() {
    super('Age');
  }

  update(dt, world) {
    const ageStore = world.getStore('Age');
    if (!ageStore) return;

    for (const [eid, age] of ageStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      age.age += dt;

      if (age.age >= age.maxAge) {
        world.markDead(eid);
      }
    }
  }
}
