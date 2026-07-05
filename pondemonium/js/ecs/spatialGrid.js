// ── Spatial Grid ────────────────────────────────────────────────────
// Uniform grid bucketing for fast "nearest entity of species X" lookups.
//
// Why this exists: SteeringSystem and FeedingSystem each independently
// scanned every entity of a target species (food, tadpole, mosquitoLarva,
// mosquito) for every single hunter, every tick — O(hunters × prey), done
// twice over (once for steering-toward, once for eating). Profiled at a
// realistic mid-session population (~440 entities): these two systems
// alone accounted for ~6.6ms of a ~6.15ms tick, i.e. essentially all of
// it, and scaled worse than linearly as population grew. This grid turns
// "scan everyone" into "scan the handful of entities in nearby cells".
//
// Rebuilt once per tick by SpatialIndexSystem (before Steering/Feeding
// run) and shared between them via world._spatialGrid — see that file
// for what's indexed and why.

export class SpatialGrid {
  constructor(cellSize = 60) {
    this.cellSize = cellSize;
    this.cells = new Map(); // "species|cx|cy" -> tuple[]
  }

  clear() {
    this.cells.clear();
  }

  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }

  _key(species, cx, cy) {
    return species + '|' + cx + '|' + cy;
  }

  insert(species, x, y, tuple) {
    const key = this._key(species, this._cellCoord(x), this._cellCoord(y));
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(tuple);
  }

  /**
   * Return every indexed tuple of `species` within `maxDist` of (x, y)
   * (plus a little slack from scanning whole cells — callers already do
   * their own precise distance check on the returned candidates, same
   * as before this existed, so the slack is harmless).
   */
  queryNear(species, x, y, maxDist) {
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);
    const cellRadius = Math.ceil(maxDist / this.cellSize) + 1;
    const results = [];
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const bucket = this.cells.get(this._key(species, cx + dx, cy + dy));
        if (bucket) results.push(...bucket);
      }
    }
    return results;
  }
}
