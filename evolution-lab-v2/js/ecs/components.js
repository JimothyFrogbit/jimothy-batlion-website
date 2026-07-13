// ── ECS Component Schemas ──────────────────────────────────────────
// Pure data bags. No methods, no logic — just fields with defaults.
// Each component is registered as a named store in the ECS world.
//
// Evolution Lab v2 components are designed for EMERGENT species — no
// hardcoded 'isPredator' or species-specific fields. All traits come
// from the genome expression pipeline.

// ── Position ────────────────────────────────────────────────────────
// Spatial coordinates and velocity. [All entities]
export function Position(x = 0, y = 0) {
  return { x, y, vx: 0, vy: 0 };
}

// ── Renderable ──────────────────────────────────────────────────────
// Visual representation. [All entities]
export function Renderable(radius = 4, color = '#88cc44') {
  return { radius, color, alpha: 1.0 };
}

// ── Genome ──────────────────────────────────────────────────────────
// Genetic data + cached phenotype expression. [All critters]
export function Genome(genotype = null, phenotype = null) {
  return { genotype, phenotype };
}

// ── SpeciesLabel ────────────────────────────────────────────────────
// Emergent species label — assigned by a clustering algorithm based on
// trait-distance. NOT a hardcoded type. [All critters]
export function SpeciesLabel(groupId = 0, name = 'Unknown') {
  return { groupId, name };
}

// ── Energy ──────────────────────────────────────────────────────────
// Metabolic resources. [All critters]
export function Energy(energy = 100, maxEnergy = 100, metabolism = 1.0) {
  return { energy, maxEnergy, metabolism };
}

// ── Age ─────────────────────────────────────────────────────────────
// Age tracking. [All critters]
export function Age(maxAge = 800) {
  return { age: 0, maxAge };
}

// ── Senses ──────────────────────────────────────────────────────────
// Detection range for food, mates, threats. Derived from genome.
export function Senses(sight = 80, smell = 40) {
  return { sight, smell };
}

// ── Mouth ───────────────────────────────────────────────────────────
// Feeding capability — gape determines max prey size.
export function Mouth(gape = 3) {
  return { gape, eatCooldown: 0 };
}

// ── FoodSource ──────────────────────────────────────────────────────
// Static food — algae/plants. High nutrition, no movement.
export function FoodSource(nutrition = 5, radius = 8) {
  return { nutrition, radius, maxCount: 1 };
}

// ── CritterConfig ───────────────────────────────────────────────────
// Runtime configuration for a critter from its expressed phenotype.
// NOT a stored component — computed per-tick by reading the genome.
// Stored here for systems to read without re-deriving.
export function CritterConfig() {
  return {
    speed: 0,
    agression: 0,
    mouthGape: 0,
    detectionRange: 0,
    bodySize: 0,
    hue: 0,
    stressResilience: 0,
  };
}

// ── Mating ───────────────────────────────────────────────────────────
// Sexual reproduction state. [All reproductively-capable critters]
export function Mating(cooldown = 30, readiness = 0) {
  return { cooldown, readiness, offspringCount: 0 };
}

// ── DeathFx ─────────────────────────────────────────────────────────
// Tracks whether death effects have been spawned. [All mortal entities]
export function DeathFx(spawned = false) {
  return { spawned };
}

// ── ECS Component Registry ──────────────────────────────────────────
// All component types with their store names and defaults.
export const COMPONENT_TYPES = {
  Position:      { factory: Position },
  Renderable:    { factory: Renderable },
  Genome:        { factory: Genome },
  SpeciesLabel:  { factory: SpeciesLabel },
  Energy:        { factory: Energy },
  Age:           { factory: Age },
  Senses:        { factory: Senses },
  Mouth:         { factory: Mouth },
  FoodSource:    { factory: FoodSource },
  CritterConfig: { factory: CritterConfig },
  Mating:        { factory: Mating },
  DeathFx:       { factory: DeathFx },
};

/** Register all component stores on an EcsWorld. Returns the world. */
export function registerAllComponents(world) {
  for (const name of Object.keys(COMPONENT_TYPES)) {
    world.registerStore(name);
  }
  return world;
}
