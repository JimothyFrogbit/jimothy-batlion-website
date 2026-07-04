// ── ECS System Registry ────────────────────────────────────────────
// Defines all systems to be ported in Phase 2.
// Phase 2: One-by-one, port each entity behaviour to an ECS system.
// Each system reads matching components and writes results.
//
// Phase 2 implementation plan:
//   1. Implement system in ecs/systems/ (e.g. MovementSystem.js)
//   2. Register it in registerAllSystems() below
//   3. Run both old and new code paths — compare for correctness
//   4. Once verified, old code can be removed in Phase 3

import { EcsSystem } from './engine.js';

// ── MovementSystem ─────────────────────────────────────────────────
// Updates Position (x, y) from velocity (vx, vy) with boundary clamping.
// Required: Position, Species
export class MovementSystem extends EcsSystem {
  constructor() { super('MovementSystem'); }
  update(dt, world) {
    // TODO Phase 2: Move each entity by vx/vy, clamp to pond bounds
    // Query: Position + Species (not flying → no flightY logic)
    // Flying entities: update flightY instead of y, then y = flightY + altitude
  }
}

// ── FeedingSystem ──────────────────────────────────────────────────
// Entities with Mouth + Energy seek nearby Nutrition and consume it.
// Required: Mouth, Energy, Steering, Position, Species
export class FeedingSystem extends EcsSystem {
  constructor() { super('FeedingSystem'); }
  update(dt, world) {
    // TODO Phase 2: For each predator/herbivore entity…
    // - Query nearby food/prey entities by Position proximity
    // - If within mouth gape, consume (reduce nutrition, increase satiation)
    // - Froglets: also eat mosquitoes
    // - DragonflyNymph: eats tadpoles + mosquito larvae
  }
}

// ── MetabolismSystem ───────────────────────────────────────────────
// Drains satiation over time, converts satiation deficit to energy drain.
// Required: Energy
export class MetabolismSystem extends EcsSystem {
  constructor() { super('MetabolismSystem'); }
  update(dt, world) {
    // TODO Phase 2: satiation -= metabolism * rate * dt
    // If satiation < 0, energy -= drain * dt, satiation = 0
  }
}

// ── GrowthSystem ───────────────────────────────────────────────────
// Increments growth toward maxSize based on satiation level.
// Required: Growth, Energy
export class GrowthSystem extends EcsSystem {
  constructor() { super('GrowthSystem'); }
  update(dt, world) {
    // TODO Phase 2: growth += growthRate * dt * (satiation > 50 ? 1 : 0.3)
    // If growth >= 1: metamorphose (spawn target entity type)
  }
}

// ── DeathSystem ────────────────────────────────────────────────────
// Kills entities that have run out of energy or exceeded maxAge.
// Required: Energy or Age, Species
export class DeathSystem extends EcsSystem {
  constructor() { super('DeathSystem'); }
  update(dt, world) {
    // TODO Phase 2: If energy <= 0 or age >= maxAge → markDead
    // Add to gene pool if applicable (froglet, mosquito, dragonfly)
    // Spawn death particles
    // Record stress death if pond active event
  }
}

// ── StressSystem ───────────────────────────────────────────────────
// Applies stress event damage to Stressable entities.
// Required: Stressable, Energy
export class StressSystem extends EcsSystem {
  constructor() { super('StressSystem'); }
  update(dt, world) {
    // TODO Phase 2: If global stress event active, apply damage scaled by
    // vulnerability = (1 - resilience)^2
  }
}

// ── ReproductionSystem ─────────────────────────────────────────────
// Generates new entities (frog spawn, mosquito eggs, algae spawn).
// Required: (world-level timers, not per-entity in Phase 2)
export class ReproductionSystem extends EcsSystem {
  constructor() { super('ReproductionSystem'); }
  update(dt, world) {
    // TODO Phase 2: Spawn frog eggs, mosquito eggs, algae based on timers
    // Sample from gene pools for genetic diversity
  }
}

// ── PredationSystem ────────────────────────────────────────────────
// Dragonfly nymphs hunt tadpoles and mosquito larvae.
// Required: Predator, Position, Steering, TargetSeek
export class PredationSystem extends EcsSystem {
  constructor() { super('PredationSystem'); }
  update(dt, world) {
    // TODO Phase 2: Each predator entity seeks nearest prey within sight
    // On contact, kill prey and gain satiation
    // Cooldown between meals
  }
}

// ── SteeringSystem ─────────────────────────────────────────────────
// Manages target selection and steering behaviour.
// Required: Steering, TargetSeek, Position, Species
export class SteeringSystem extends EcsSystem {
  constructor() { super('SteeringSystem'); }
  update(dt, world) {
    // TODO Phase 2: For each entity with TargetSeek + Steering:
    // - Find nearest valid target within sight
    // - Apply hysteresis (lock timer)
    // - steerToward: blend velocity toward target
    // - Wander behaviour when no target: random direction changes
    // - Froglet: jump impulse when cooldown expires
  }
}

// ── MorphSystem ────────────────────────────────────────────────────
// Tracks morph clusters and speciation.
// Required: (reads GenePool, not per-entity)
export class MorphSystem extends EcsSystem {
  constructor() { super('MorphSystem'); }
  update(dt, world) {
    // TODO Phase 2: Track gene pool clusters
    // Detect morphs from phenotype distributions
    // Record lineage
  }
}

// ── ParticleSystem ─────────────────────────────────────────────────
// Updates visual particles (age, velocity, gravity, fade).
// Required: ParticleState, Position
export class ParticleSystem extends EcsSystem {
  constructor() { super('ParticleSystem'); }
  update(dt, world) {
    // TODO Phase 2: life -= dt, vy += gravity * dt, alive = life <= 0
  }
}

// ── RenderSystem ───────────────────────────────────────────────────
// Draws all entities to the canvas (Phase 3: replaces pond.render()).
// Required: Position, Renderable, Species (+ optional components)
export class RenderSystem extends EcsSystem {
  constructor() { super('RenderSystem'); }
  update(dt, world) {
    // TODO Phase 3: Read Position + Renderable + Species
    // Draw each entity according to its type and animation state
    // This is a big one — replaces all species-specific draw methods
  }
}

// ── CautionSystem ──────────────────────────────────────────────────
// Tracks mouse hover and entity selection.
// Required: (mouse state from pond)
export class CautionSystem extends EcsSystem {
  constructor() { super('CautionSystem'); }
  update(dt, world) {
    // TODO Phase 3: Get nearest entity to mouse position
    // Highlight hovered entity
    // Handle click-to-select
  }
}

// ── Factory ────────────────────────────────────────────────────────
/** Register all Phase 2 systems on a world. */
export function registerAllSystems(world) {
  world.addSystem(new MovementSystem());
  world.addSystem(new MetabolismSystem());
  world.addSystem(new SteeringSystem());
  world.addSystem(new FeedingSystem());
  world.addSystem(new GrowthSystem());
  world.addSystem(new PredationSystem());
  world.addSystem(new StressSystem());
  world.addSystem(new DeathSystem());
  world.addSystem(new ParticleSystem());
  world.addSystem(new ReproductionSystem());
  world.addSystem(new MorphSystem());
  // Phase 3 only:
  // world.addSystem(new RenderSystem());
  // world.addSystem(new CautionSystem());
  return world;
}
