// ── Utility Functions ────────────────────────────────────────────────
export const rand = (a = 1, b = 0) => Math.random() * (b - a) + a;
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const rndChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];