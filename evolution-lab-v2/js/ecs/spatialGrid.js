// ── Spatial Grid ────────────────────────────────────────────────────
// Uniform grid bucketing for fast nearest-entity queries.
// Ported from Pondemonium's spatialGrid.js.
//
// Rebuilt once per tick by SpatialIndexSystem and shared between systems
// via world._spatialGrid. Prevents O(n²) loops for nearest-critter lookups.

export class SpatialGrid {
  constructor(cellSize = 60) {
    this.cellSize = cellSize;
    this.cells = new Map(); // "cx|cy" -> entityId[]
  }

  clear() {
    this.cells.clear();
  }

  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }

  _key(cx, cy) {
    return cx + '|' + cy;
  }

  /** Insert an entity position into the grid for querying. */
  insert(entityId, x, y) {
    const key = this._key(this._cellCoord(x), this._cellCoord(y));
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(entityId);
    return key;
  }

  /**
   * Query every inserted entity within `maxDist` of (x, y).
   * Returns array of entityIds (with some slack — callers do their own
   * precise distance check).
   */
  queryNear(x, y, maxDist) {
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);
    const cellRadius = Math.ceil(maxDist / this.cellSize) + 1;
    const results = new Set();
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = this._key(cx + dx, cy + dy);
        const bucket = this.cells.get(key);
        if (bucket) {
          for (const id of bucket) {
            results.add(id);
          }
        }
      }
    }
    return [...results];
  }
}
