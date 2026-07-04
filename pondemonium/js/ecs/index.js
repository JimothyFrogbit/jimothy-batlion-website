// ── ECS Index ───────────────────────────────────────────────────────
// Re-export everything from the ECS modules for convenient importing.
//
// Usage:
//   import { EcsWorld, registerAllComponents } from './ecs/index.js';
//   const world = new EcsWorld();
//   registerAllComponents(world);

export {
  EcsEntity,
  EcsSystem,
  ComponentStore,
  EcsWorld,
  nextEntityId,
} from './engine.js';

export {
  Position,
  Renderable,
  Species,
  Genome,
  Age,
  Growth,
  Energy,
  Mouth,
  Steering,
  TargetSeek,
  Jump,
  Animation,
  Flight,
  EggSpawn,
  FrogSpawnTiming,
  Predator,
  LifeLimited,
  Nutrition,
  Audio,
  Stressable,
  DeathFx,
  ParticleState,
  EdgeSpawn,
  COMPONENT_TYPES,
  registerAllComponents,
} from './components.js';
