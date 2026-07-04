// ── Global Registry ──────────────────────────────────────────────────
// Provides a shared reference to the Pond instance so entity modules
// can access it without circular imports.

/** @type {import('./pond.js').Pond} */
export let pond = null;

export function registerPond(p) {
  pond = p;
}

// Shared entity ID counter
export let ID_COUNTER = 0;
export function nextId() {
  return ID_COUNTER++;
}