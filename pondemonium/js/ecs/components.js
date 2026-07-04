// ── ECS Component Schemas ──────────────────────────────────────────
// Pure data bags. No methods, no logic — just fields with defaults.
// Each component is registered as a named store in the ECS world.
// Fields are documented with [entity types that use them].
//
// Import world and create components via:
//   world.addComponent(entityId, 'Position', { x: 10, y: 20 });
//   const pos = world.getComponent(entityId, 'Position');

// ── Position ────────────────────────────────────────────────────────
// Spatial coordinates and velocity. [All entities]
export function Position(x = 0, y = 0) {
  return { x, y, vx: 0, vy: 0, flightY: y };
}

// ── Renderable ──────────────────────────────────────────────────────
// Visual representation. [All entities]
// layer: 0=background, 1=submerged, 2=surface, 3=flying
export function Renderable(radius = 4, color = '#88cc44', layer = 1) {
  return { radius, color, alpha: 1.0, layer, hovered: false };
}

// ── Species ─────────────────────────────────────────────────────────
// Entity type classification. [All alive entities]
// type: 'food', 'tadpole', 'froglet', 'frogSpawn', 'mosquitoEgg',
//       'mosquitoLarva', 'mosquito', 'dragonflyNymph', 'dragonflyAdult', 'particle'
export function Species(type) {
  return { type };
}

// ── Genome ──────────────────────────────────────────────────────────
// Genetic data + cached phenotype expression. [Food, FrogSpawn, Tadpole,
// Froglet, Mosquito, DragonflyNymph, DragonflyAdult]
export function Genome(genotype = null, phenotype = null) {
  return { genotype, phenotype };
}

// ── Age ─────────────────────────────────────────────────────────────
// Lifecycle timing. [All entities except particles]
export function Age(maxAge = Infinity) {
  return { age: 0, maxAge };
}

// ── Growth ──────────────────────────────────────────────────────────
// Maturation / size progression. [Tadpole, Froglet, MosquitoLarva,
// DragonflyNymph]
export function Growth(growth = 0, maxSize = 10, growthRate = 0.001, targetEntityType = null) {
  return { growth, maxSize, growthRate, targetEntityType };
}

// ── Energy ──────────────────────────────────────────────────────────
// Metabolic resources. [Tadpole, Froglet, DragonflyNymph]
export function Energy(energy = 100, maxEnergy = 100) {
  return { energy, maxEnergy, satiation: 100, metabolism: 1.0 };
}

// ── Mouth ───────────────────────────────────────────────────────────
// Feeding capability. [Tadpole, Froglet, DragonflyNymph]
export function Mouth(gape = 3, diet = 'algae') {
  // diet: 'algae', 'mosquito', 'tadpole'
  return { gape, diet, eatCooldown: 0 };
}

// ── Steering ────────────────────────────────────────────────────────
// Movement physics and targeting. [MovingEntity subclasses]
export function Steering(speed = 1.0, agility = 1.0, sight = 60) {
  return { speed, agility, sight };
}

// ── TargetSeek ──────────────────────────────────────────────────────
// Active target pursuit state. [MovingEntity subclasses]
export function TargetSeek() {
  return {
    lockedTargetId: null,
    lockTimer: 0,
    lockDuration: 45,
    targetDir: 0,
    targetTimer: 0,
    hysteresis: 0.85,  // 85% closer required to switch
  };
}

// ── Jump ────────────────────────────────────────────────────────────
// Froglet jump capability. [Froglet only]
export function Jump(jumpDrive = 1.0) {
  return { cooldown: 0, jumpDrive, minInterval: 20, maxInterval: 60 };
}

// ── Animation ───────────────────────────────────────────────────────
// Visual oscillation offsets. [Most entities]
export function Animation(phase = Math.random() * Math.PI * 2) {
  return { phase, wobble: Math.random() * 1000, bobPhase: Math.random() * Math.PI * 2 };
}

// ── Flight ──────────────────────────────────────────────────────────
// Flying entity height tracking. [Mosquito, DragonflyAdult]
export function Flight(altitude = -15, wingAngle = 0) {
  return { altitude, wingAngle };
}

// ── EggSpawn ────────────────────────────────────────────────────────
// Mosquito egg-laying. [MosquitoEggRaft only]
export function EggSpawn(eggCount = 12, incubation = 200) {
  return { eggCount, incubation, timer: 0, driftX: Math.random() * 0.1 - 0.05 };
}

// ── FrogSpawnTiming ────────────────────────────────────────────────
// Frog spawn hatch timing. [FrogSpawn only]
export function FrogSpawnTiming(incubation = 300, hatchTimer = 300, clusterCount = 4) {
  return { incubation, hatchTimer, clusterCount };
}

// ── Predator ────────────────────────────────────────────────────────
// Predator-specific combat. [DragonflyNymph only]
export function Predator(attackCooldown = 20, meals = 0, preferredPrey = ['tadpole', 'mosquitoLarva']) {
  return { attackCooldown, meals, preferredPrey, huntCooldown: 0 };
}

// ── LifeLimited ─────────────────────────────────────────────────────
// Entities that die after a fixed lifespan. [Mosquito, DragonflyAdult]
export function LifeLimited(lifespan = 400) {
  return { lifespan, age: 0 };
}

// ── Nutrition ───────────────────────────────────────────────────────
// Food value when eaten. [Food only]
export function Nutrition(value = 5) {
  return { value };
}

// ── Audio ───────────────────────────────────────────────────────────
// Audio cue tracking. [Froglet (croak), Mosquito (buzz), DragonflyAdult (wing)]
export function Audio(lastSoundTime = 0, soundType = 'croak', minInterval = 120) {
  return { lastSoundTime, soundType, minInterval };
}

// ── Stressable ──────────────────────────────────────────────────────
// Vulnerability/resilience to stress events. [Tadpole, Froglet,
// MosquitoLarva, DragonflyNymph, FrogSpawn, MosquitoEgg]
export function Stressable(resilience = 0.3) {
  return { resilience };
}

// ── DeathFx ─────────────────────────────────────────────────────────
// Tracks whether death effects have been spawned. [All mortal entities]
export function DeathFx(spawned = false) {
  return { spawned };
}

// ── ParticleState ───────────────────────────────────────────────────
// Visual particle life. [Particle only]
export function ParticleState(life = 30, maxLife = 30, size = 3, gravity = 0.03, type = 'dot', color = '#88cc44') {
  return { life, maxLife, size, gravity, type, color };
}

// ── Regeneration ────────────────────────────────────────────────────
// How entities from the pond edge spawn. [FrogSpawn, MosquitoEggRaft]
export function EdgeSpawn(genotype = null) {
  return { genotype };
}

// ── ECS Component Registry ──────────────────────────────────────────
// All component types with their store names and defaults.
// Use this to register all stores on a fresh EcsWorld.
export const COMPONENT_TYPES = {
  Position:           { factory: Position },
  Renderable:         { factory: Renderable },
  Species:            { factory: Species },
  Genome:             { factory: Genome },
  Age:                { factory: Age },
  Growth:             { factory: Growth },
  Energy:             { factory: Energy },
  Mouth:              { factory: Mouth },
  Steering:           { factory: Steering },
  TargetSeek:         { factory: TargetSeek },
  Jump:               { factory: Jump },
  Animation:          { factory: Animation },
  Flight:             { factory: Flight },
  EggSpawn:           { factory: EggSpawn },
  FrogSpawnTiming:    { factory: FrogSpawnTiming },
  Predator:           { factory: Predator },
  LifeLimited:        { factory: LifeLimited },
  Nutrition:          { factory: Nutrition },
  Audio:              { factory: Audio },
  Stressable:         { factory: Stressable },
  DeathFx:            { factory: DeathFx },
  ParticleState:      { factory: ParticleState },
  EdgeSpawn:          { factory: EdgeSpawn },
};

/** Register all component stores on an EcsWorld. Returns the world. */
export function registerAllComponents(world) {
  for (const name of Object.keys(COMPONENT_TYPES)) {
    world.registerStore(name);
  }
  return world;
}
