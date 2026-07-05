// ── Global Registry ──────────────────────────────────────────────────
// Provides a shared reference to the Pond instance so ui.js can access
// it without a circular import.

/** @type {import('./pond.js').Pond} */
export let pond = null;

export function registerPond(p) {
  pond = p;
}