// ── ECS Adapter ─────────────────────────────────────────────────────
// Owns the global ECS world instance and its (re)initialisation.
// ECS is the only simulation path — Pond just renders whatever this
// world's systems produce (via ecs-bridge.js's syncEcsToPond).
//
// Usage:
//   import { ecsWorld, initEcs } from './ecs/adapter.js';
//   const world = initEcs(pond);

import { EcsWorld, registerAllComponents } from './index.js';
import { registerAllSystems } from './systems.js';

/** Global ECS world instance. */
export let ecsWorld = null;

/** Saved pondRef for reset. */
let _pondRef = null;

/** Initialise the ECS world. */
export function initEcs(pondRef) {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world, pondRef);
  ecsWorld = world;
  _pondRef = pondRef;

  return world;
}

/** Reset the ECS world (for pond reset). */
export function resetEcsWorld() {
  if (ecsWorld) {
    ecsWorld.clear();
    ecsWorld = null;
  }
  return initEcs(_pondRef);
}
