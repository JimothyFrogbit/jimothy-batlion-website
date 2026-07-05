// ── ECS System Registry ────────────────────────────────────────────
// Registers every system in the order they run each tick. ECS is the
// only simulation path — see systems/*.js for individual behaviours.
//
// ── Why order matters ────────────────────────────────────────────────
// world.update(dt) runs registered systems in this exact order, once
// per tick. Several systems depend on another having already run this
// same tick:
//   - AgeSystem must run before ReleaseSystem/MorphSystem/DeathSystem,
//     which gate on Age.age / LifeLimited.age thresholds — stale age
//     data means those gates never open (this broke "frogs never
//     leave the pond" — see git history).
//   - GrowthSystem must run before MorphSystem, which triggers on
//     growth.growth >= 1.
//   - MorphSystem must run before ReleaseSystem/HatchSystem, so a
//     freshly-morphed froglet/mosquito/dragonflyAdult is visible to
//     them the same tick it's created (not a correctness requirement,
//     just avoids a one-tick lag).
//   - FeedingSystem must run after MetabolismSystem drains satiation,
//     so a same-tick meal can restore it before DeathSystem checks
//     energy. (There is no separate PredationSystem — dragonfly-nymph
//     hunting/killing/particles/satiation/growth is all handled inside
//     FeedingSystem._tryHunt. An earlier PredationSystem duplicated
//     the kill+particles half of that with no benefit to the nymph and
//     was removed — see git history if you're looking for it.)
//   - SpatialIndexSystem must run after MovementSystem (so it indexes
//     this tick's positions, not last tick's) and before SteeringSystem/
//     FeedingSystem (both read world._spatialGrid instead of scanning
//     every entity of a species — see spatialGrid.js; this is the
//     difference between ~6ms/tick and ~0.3ms/tick at a few hundred
//     entities, profiled via ecs/perf-bench.mjs).
// If you add a system whose behaviour depends on another component's
// freshness this tick, add it here rather than relying on next-tick
// convergence — and add a case to ecs/integration.test.js that would
// fail if the ordering (or the system) were removed.

import { MovementSystem } from './systems/MovementSystem.js';
import { SpatialIndexSystem } from './systems/SpatialIndexSystem.js';
import { AgeSystem } from './systems/AgeSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { MetabolismSystem } from './systems/MetabolismSystem.js';
import { SteeringSystem } from './systems/SteeringSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { GrowthSystem } from './systems/GrowthSystem.js';
import { DeathSystem } from './systems/DeathSystem.js';
import { FeedingSystem } from './systems/FeedingSystem.js';
import { StressSystem } from './systems/StressSystem.js';
import { ReproductionSystem } from './systems/ReproductionSystem.js';
import { MorphSystem } from './systems/MorphSystem.js';
import { HatchSystem } from './systems/HatchSystem.js';
import { ReleaseSystem } from './systems/ReleaseSystem.js';

/** Register all systems on a world, in dependency order. Returns refs to
 *  the systems Pond needs for UI/stats delegation (see setEcsSystems). */
export function registerAllSystems(world, pondRef) {
  world.addSystem(new MovementSystem());
  const ageSystem = new AgeSystem();
  world.addSystem(ageSystem);
  world.addSystem(new AnimationSystem());
  world.addSystem(new MetabolismSystem());
  world.addSystem(new SpatialIndexSystem());
  world.addSystem(new SteeringSystem());
  world.addSystem(new ParticleSystem());
  world.addSystem(new GrowthSystem());
  world.addSystem(new DeathSystem());
  world.addSystem(new FeedingSystem());

  // Self-contained systems (own internal timers, no pondRef dependency)
  const stressSystem = new StressSystem();
  const reproductionSystem = new ReproductionSystem();
  world.addSystem(stressSystem);
  world.addSystem(reproductionSystem);

  const morphSystem = new MorphSystem();
  world.addSystem(morphSystem);

  const releaseSystem = new ReleaseSystem();
  world.addSystem(releaseSystem);

  world.addSystem(new HatchSystem());

  // Wire ECS systems into pond for UI/stats delegation
  if (pondRef) {
    pondRef.setEcsSystems(stressSystem, reproductionSystem, releaseSystem, ageSystem, morphSystem);
  }

  return { world, stressSystem, reproductionSystem, releaseSystem, ageSystem, morphSystem };
}
