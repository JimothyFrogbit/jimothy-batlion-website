// ── Spatial Index System ────────────────────────────────────────────
// Rebuilds the spatial grid every tick so movement/feeding/steering
// systems can do O(1) nearest-neighbor queries instead of O(n²) scans.

import { EcsSystem } from '../engine.js';
import { SpatialGrid } from '../spatialGrid.js';

export class SpatialIndexSystem extends EcsSystem {
  constructor() {
    super('SpatialIndex');
  }

  init(world) {
    world._spatialGrid = new SpatialGrid(60);
  }

  update(dt, world) {
    const grid = world._spatialGrid;
    grid.clear();

    for (const [eid, pos] of world.getStore('Position').getAll()) {
      if (!world.hasEntity(eid)) continue;
      grid.insert(eid, pos.x, pos.y);
    }
  }
}
