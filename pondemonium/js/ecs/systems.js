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
import { PredationSystem } from './systems/PredationSystem.js';
import { StressSystem } from './systems/StressSystem.js';
import { ReproductionSystem } from './systems/ReproductionSystem.js';

// Phase 2b systems (now all imported):
// import { RenderSystem } from './systems/RenderSystem.js';
// import { CautionSystem } from './systems/CautionSystem.js';
import { MorphSystem } from './systems/MorphSystem.js';
import { HatchSystem } from './systems/HatchSystem.js';
import { ReleaseSystem } from './systems/ReleaseSystem.js';

/** Register all Phase 2 systems on a world. Returns refs to key systems. */
export function registerAllSystems(world, pondRef) {
  // Phase 2 — Core systems (implemented)
  world.addSystem(new MovementSystem());
  world.addSystem(new MetabolismSystem());
  world.addSystem(new SteeringSystem());
  world.addSystem(new ParticleSystem());
  world.addSystem(new GrowthSystem());
  world.addSystem(new DeathSystem());
  world.addSystem(new FeedingSystem());
  world.addSystem(new PredationSystem());

  // Phase 3 — Stress + Reproduction (self-contained, no pondRef)
  const stressSystem = new StressSystem();
  const reproductionSystem = new ReproductionSystem();
  world.addSystem(stressSystem);
  world.addSystem(reproductionSystem);

  // Phase 2b — Morph (implemented)
  world.addSystem(new MorphSystem());

  // Phase 3 — ReleaseSystem (froglet → genePool release)
  const releaseSystem = new ReleaseSystem();
  world.addSystem(releaseSystem);

  // Phase 3 — HatchSystem (frog spawn → tadpoles, mosquito eggs → larvae)
  world.addSystem(new HatchSystem());

  // Wire ECS systems into pond for UI/stats delegation
  if (pondRef) {
    pondRef.setEcsSystems(stressSystem, reproductionSystem, releaseSystem);
  }

  // Phase 3 only:
  // world.addSystem(new RenderSystem());
  // world.addSystem(new CautionSystem());
  return { world, stressSystem, reproductionSystem, releaseSystem };
}
