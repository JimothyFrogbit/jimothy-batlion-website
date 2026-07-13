// ── ECS System Registry ────────────────────────────────────────────
// Registers every system in the order they run each tick.
//
// ── Why order matters ──────────────────────────────────────────────
//   - SpatialIndexSystem must run after MovementSystem (indexes this
//     tick's positions) and before SteeringSystem/FeedingSystem
//   - AgeSystem runs before DeathSystem so age-based deaths trigger
//   - MetabolismSystem runs before DeathSystem so starvation triggers
//   - FeedingSystem runs after MetabolismSystem so low-energy critters
//     eat the same tick they'd otherwise starve

import { SpatialIndexSystem } from './systems/SpatialIndexSystem.js';
import { AgeSystem } from './systems/AgeSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { SteeringSystem } from './systems/SteeringSystem.js';
import { MetabolismSystem } from './systems/MetabolismSystem.js';
import { FeedingSystem } from './systems/FeedingSystem.js';
import { DeathSystem } from './systems/DeathSystem.js';
import { MatingSystem } from './systems/MatingSystem.js';

/** Register all systems on a world, in dependency order. */
export function registerAllSystems(world) {
  world.addSystem(new MovementSystem());
  world.addSystem(new SpatialIndexSystem());
  world.addSystem(new AgeSystem());
  world.addSystem(new MetabolismSystem());
  world.addSystem(new FeedingSystem());
  world.addSystem(new SteeringSystem());
  world.addSystem(new MatingSystem());
  world.addSystem(new DeathSystem());
}
