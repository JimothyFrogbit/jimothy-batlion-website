// ── SpatialIndexSystem ───────────────────────────────────────────────
// Rebuilds world._spatialGrid once per tick, before SteeringSystem and
// FeedingSystem run — see spatialGrid.js for why this exists.
//
// Only indexes the species that are actually hunted/eaten by another
// system: food (everyone eats it), tadpole + mosquitoLarva (dragonfly
// nymph prey), mosquito (froglet prey). Everything else has no reason
// to be findable this way, so isn't indexed (keeps the grid small).
//
// Must run after MovementSystem (so positions are this tick's, not
// last tick's) and before SteeringSystem/FeedingSystem (so they see a
// fresh grid). See systems.js for the full ordering rationale.

import { EcsSystem } from '../engine.js';
import { SpatialGrid } from '../spatialGrid.js';

const INDEXED_SPECIES = new Set(['food', 'tadpole', 'mosquitoLarva', 'mosquito']);

export class SpatialIndexSystem extends EcsSystem {
  constructor() {
    super('SpatialIndexSystem');
  }

  update(dt, world) {
    let grid = world._spatialGrid;
    if (!grid) {
      grid = new SpatialGrid(60);
      world._spatialGrid = grid;
    } else {
      grid.clear();
    }

    const posStore = world.getStore('Position');
    const speciesStore = world.getStore('Species');
    const renderStore = world.getStore('Renderable');
    const nutritionStore = world.getStore('Nutrition');
    if (!posStore || !speciesStore) return;

    for (const [eid, species] of speciesStore.getAll()) {
      if (!INDEXED_SPECIES.has(species.type)) continue;
      if (!world.hasEntity(eid)) continue; // skip entities marked dead this tick
      const pos = posStore.get(eid);
      if (!pos) continue;

      const tuple = { entityId: eid, Position: pos };
      if (renderStore && renderStore.has(eid)) tuple.Renderable = renderStore.get(eid);
      if (nutritionStore && nutritionStore.has(eid)) tuple.Nutrition = nutritionStore.get(eid);

      grid.insert(species.type, pos.x, pos.y, tuple);
    }
  }
}
