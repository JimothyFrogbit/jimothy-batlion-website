// ── Global Registry ──────────────────────────────────────────────────
// Shared state for cross-module access without circular imports.

/** @type {import('./main.js').SimState} */
export let simState = null;

export function registerSimState(s) {
  simState = s;
}
