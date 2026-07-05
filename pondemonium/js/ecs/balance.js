// ── Maturation / Lifecycle Balance Constants ─────────────────────────
// Single home for "how long does it take X to grow up" numbers, which
// were previously scattered as magic numbers across factories.js,
// HatchSystem.js, MorphSystem.js, ReproductionSystem.js, ReleaseSystem.js,
// and FeedingSystem.js — findable only by grepping for growth rates.
//
// MATURATION_SLOWDOWN is a single dial: every duration below is derived
// from it, so bumping it slows every species' maturation proportionally
// without re-deriving the *relative* biological ratios between species
// (mosquito larvae still mature faster than tadpoles, dragonfly nymphs
// still take longest, etc. — see each constant's comment for that
// reasoning, carried over from the ECS bug-fix pass this was born from).
//
// A growth *rate* divides by the slowdown (smaller increment per tick);
// an *incubation/age threshold* multiplies by it (longer wait).
export const MATURATION_SLOWDOWN = 4;

// ── Tadpole → Froglet (via GrowthSystem, created by factories.createTadpole) ──
// Original range lerp(0.0013, 0.0043, growthSpeed).
export const TADPOLE_GROWTH_RATE = [0.0013 / MATURATION_SLOWDOWN, 0.0043 / MATURATION_SLOWDOWN];

// ── Froglet growth 0.85 → 1.0 (via GrowthSystem, set at MorphSystem._morphToFroglet) ──
// Original range lerp(0.0008, 0.003, growthSpeed).
export const FROGLET_GROWTH_RATE = [0.0008 / MATURATION_SLOWDOWN, 0.003 / MATURATION_SLOWDOWN];

// ── Froglet → released frog (ReleaseSystem gate) ──
// Original threshold: age > 600.
export const FROGLET_RELEASE_MIN_AGE = 600 * MATURATION_SLOWDOWN;

// ── MosquitoLarva → Mosquito (via GrowthSystem, set at HatchSystem egg-hatch) ──
// Deliberately faster than tadpoles even before MATURATION_SLOWDOWN — real
// mosquito larva-to-adult takes ~1-2 weeks vs. a tadpole's ~6-12 weeks
// (4-6x). This range averages ~2.7x TADPOLE_GROWTH_RATE, preserving that
// ratio under the shared slowdown rather than the full real-world gap
// (to avoid destabilizing pond balance — see ReproductionSystem's
// population caps, which are the backstop if it needs to go further).
export const MOSQUITO_LARVA_GROWTH_RATE = [0.005 / MATURATION_SLOWDOWN, 0.010 / MATURATION_SLOWDOWN];

// ── FrogSpawn → Tadpole hatch (ReproductionSystem._spawnFrogSpawn) ──
// Original: fixed 300-tick incubation.
export const FROG_SPAWN_INCUBATION = 300 * MATURATION_SLOWDOWN;

// ── MosquitoEgg → MosquitoLarva hatch (ReproductionSystem._spawnMosquitoEgg) ──
// Original range rand(120, 300).
export const MOSQUITO_EGG_INCUBATION = [120 * MATURATION_SLOWDOWN, 300 * MATURATION_SLOWDOWN];

// ── DragonflyNymph → DragonflyAdult (MorphSystem age gate + FeedingSystem meal growth) ──
// Nymph growth is entirely predation-driven, not a per-tick rate — it only
// increments when a meal is caught (FeedingSystem._tryHunt). The age gate
// stops a single lucky early meal from letting one emerge almost instantly;
// real naiads take a long time to develop regardless of feeding success.
// Original: age > 500, +0.08 growth per tadpole meal, +0.04 per larva meal
// (~13 tadpole meals or ~25 larva meals to mature, before the slowdown).
export const DRAGONFLY_NYMPH_MIN_AGE = 500 * MATURATION_SLOWDOWN;
export const DRAGONFLY_NYMPH_GROWTH_PER_TADPOLE_MEAL = 0.08 / MATURATION_SLOWDOWN;
export const DRAGONFLY_NYMPH_GROWTH_PER_LARVA_MEAL = 0.04 / MATURATION_SLOWDOWN;
