// ── Shared Nearest-Entity Query ──────────────────────────────────────
// Used by SteeringSystem (steer-toward-target) and FeedingSystem
// (find-something-to-eat) — both need "nearest entity of species X
// within maxDist, matching an optional filter". Previously each system
// had its own copy of this scan; extracted so the spatial-grid fast
// path (see spatialGrid.js) only needs to be written once.
//
// Uses world._spatialGrid when available and the species is indexed
// there (see SpatialIndexSystem's INDEXED_SPECIES) — falls back to a
// full linear scan otherwise, so this works unchanged in unit tests
// that construct a world without registering SpatialIndexSystem.

const GRID_INDEXED = new Set(['food', 'tadpole', 'mosquitoLarva', 'mosquito']);

export function findNearest(world, pos, requiredStores, speciesType, maxDist, filter) {
  const grid = world._spatialGrid;
  if (grid && speciesType && GRID_INDEXED.has(speciesType)) {
    return findNearestViaGrid(grid, world, pos, speciesType, maxDist, filter);
  }
  return findNearestViaScan(world, pos, requiredStores, speciesType, maxDist, filter);
}

function findNearestViaGrid(grid, world, pos, speciesType, maxDist, filter) {
  let best = null;
  let bestD = maxDist;
  for (const c of grid.queryNear(speciesType, pos.x, pos.y, maxDist)) {
    // Grid is a once-per-tick snapshot; an earlier hunter this same tick
    // may have already eaten this candidate — skip anything already dead.
    if (!world.hasEntity(c.entityId)) continue;
    if (filter && !filter(c)) continue;
    const d = Math.hypot(pos.x - c.Position.x, pos.y - c.Position.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function findNearestViaScan(world, pos, requiredStores, speciesType, maxDist, filter) {
  let best = null;
  let bestD = maxDist;
  for (const c of world.queryData(...requiredStores)) {
    if (!world.hasEntity(c.entityId)) continue;
    if (speciesType && (!c.Species || c.Species.type !== speciesType)) continue;
    if (filter && !filter(c)) continue;
    const cx = c.Position ? c.Position.x : 0;
    const cy = c.Position ? c.Position.y : 0;
    const d = Math.hypot(pos.x - cx, pos.y - cy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
