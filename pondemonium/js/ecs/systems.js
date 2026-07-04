// ── ECS System Registry ────────────────────────────────────────────
// Phase 2: Import and register real system implementations.
// systems/ directory contains one file per system.
//
// Phase 2 implementation plan:
//   1. Implement system in ecs/systems/ (e.g. MovementSystem.js)
//   2. Register it in registerAllSystems() below
//   3. Run both old and new code paths — compare for correctness
//   4. Once verified, old code can be removed in Phase 3

import { EcsSystem } from './engine.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { MetabolismSystem } from './systems/MetabolismSystem.js';
import { SteeringSystem } from './systems/SteeringSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { GrowthSystem } from './systems/GrowthSystem.js';
import { DeathSystem } from './systems/DeathSystem.js';
import { FeedingSystem } from './systems/FeedingSystem.js';

// Phase 2b systems (not yet imported):
// import { PredationSystem } from './systems/PredationSystem.js';
// import { StressSystem } from './systems/StressSystem.js';
// import { ReproductionSystem } from './systems/ReproductionSystem.js';
// import { MorphSystem } from './systems/MorphSystem.js';
// import { RenderSystem } from './systems/RenderSystem.js';
// import { CautionSystem } from './systems/CautionSystem.js';

/** Register all Phase 2 systems on a world. */
export function registerAllSystems(world, pondRef) {
  // Phase 2 — Core systems (implemented)
  world.addSystem(new MovementSystem());
  world.addSystem(new MetabolismSystem());
  world.addSystem(new SteeringSystem(pondRef));
  world.addSystem(new ParticleSystem());
  world.addSystem(new GrowthSystem());
  world.addSystem(new DeathSystem());
  world.addSystem(new FeedingSystem(pondRef));

  // Phase 2b — Coming soon
  // world.addSystem(new PredationSystem());
  // world.addSystem(new StressSystem());
  // world.addSystem(new ReproductionSystem());
  // world.addSystem(new MorphSystem());

  // Phase 3 only:
  // world.addSystem(new RenderSystem());
  // world.addSystem(new CautionSystem());
  return world;
}
