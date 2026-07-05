// ── ECS Adapter ─────────────────────────────────────────────────────
// Bridges the old entity architecture with the new ECS world.
// Phase 1: ECS runs alongside — no swapping, no behaviour changes.
// Phase 2: Port behaviours to ECS systems one at a time.
// Phase 3: Flip the switch, remove old code.
//
// Usage:
//   import { ecsWorld, initEcs } from './ecs/adapter.js';
//   const world = initEcs();

import { EcsWorld, registerAllComponents, Position, Renderable, Species } from './index.js';
import { registerAllSystems } from './systems.js';

/** Global ECS world instance. */
export let ecsWorld = null;

/** Saved pondRef for reset. */
let _pondRef = null;

/** Initialise the ECS world alongside the existing architecture. */
export function initEcs(pondRef) {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world, pondRef);
  ecsWorld = world;
  _pondRef = pondRef;

  // Enable ECS mode on the pond — skips legacy entity logic
  if (pondRef) {
    pondRef.enableEcsMode();
  }

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

// ── Entity Adapters ─────────────────────────────────────────────────
// Convert old entity instances to ECS components.
// These run alongside the old code — data flows both ways.

/** Register an old-style entity's data in the ECS world. Returns entityId. */
export function adoptEntity(oldEntity, speciesType) {
  if (!ecsWorld) return null;

  const eid = ecsWorld.createEntity();

  // All entities have position + renderable
  ecsWorld.addComponent(eid, 'Position', Position(oldEntity.x, oldEntity.y));
  ecsWorld.addComponent(eid, 'Renderable', Renderable(
    oldEntity.radius || 4,
    oldEntity.color || null,
    speciesLayer(speciesType)
  ));
  ecsWorld.addComponent(eid, 'Species', Species(speciesType));

  // Age (most entities have this)
  if (oldEntity.age !== undefined) {
    ecsWorld.addComponent(eid, 'Age', { age: oldEntity.age, maxAge: oldEntity.maxAge || Infinity });
  }

  // Energy + nutrition (alive entities)
  if (oldEntity.energy !== undefined) {
    ecsWorld.addComponent(eid, 'Energy', {
      energy: oldEntity.energy,
      maxEnergy: oldEntity.maxEnergy || 100,
      satiation: oldEntity.satiation || 100,
      metabolism: oldEntity._metabolism || 1.0,
    });
  }

  // Growth
  if (oldEntity.growth !== undefined) {
    ecsWorld.addComponent(eid, 'Growth', {
      growth: oldEntity.growth,
      maxSize: oldEntity._maxSize || 10,
      growthRate: oldEntity._growthRate || 0.001,
    });
  }

  // Mouth/feeding
  if (oldEntity._mouth !== undefined) {
    ecsWorld.addComponent(eid, 'Mouth', { gape: oldEntity._mouth, diet: 'algae', eatCooldown: 0 });
  }

  // Steering
  if (oldEntity._speed !== undefined) {
    ecsWorld.addComponent(eid, 'Steering', {
      speed: oldEntity._speed,
      agility: oldEntity._agility || 1.0,
      sight: oldEntity._sight || 60,
    });
  }

  // Target seeking
  if (oldEntity._lockedTarget !== undefined) {
    ecsWorld.addComponent(eid, 'TargetSeek', {
      lockedTargetId: null, // old entities track by reference, not ID
      lockTimer: oldEntity._lockTimer || 0,
      lockDuration: 45,
      targetDir: oldEntity.targetDir || 0,
      targetTimer: oldEntity.targetTimer || 0,
    });
  }

  // Jump (froglets)
  if (oldEntity.jumpCooldown !== undefined) {
    ecsWorld.addComponent(eid, 'Jump', {
      cooldown: oldEntity.jumpCooldown,
      jumpDrive: oldEntity._jumpDrive || 1.0,
    });
  }

  // Animation
  if (oldEntity.phase !== undefined) {
    ecsWorld.addComponent(eid, 'Animation', {
      phase: oldEntity.phase,
      wobble: oldEntity.wobble || 0,
      bobPhase: oldEntity.bobPhase || 0,
    });
  }

  // Flight (flying entities)
  if (oldEntity.flightY !== undefined) {
    ecsWorld.addComponent(eid, 'Flight', {
      altitude: oldEntity.altitude || -15,
      wingAngle: oldEntity._wingAngle || 0,
    });
  }

  // Predator
  if (oldEntity._attackCooldown !== undefined) {
    ecsWorld.addComponent(eid, 'Predator', {
      attackCooldown: oldEntity._attackCooldown,
      meals: oldEntity._meals || 0,
      huntCooldown: 0,
    });
  }

  // LifeLimited (mosquito, dragonfly adult)
  if (oldEntity.life !== undefined) {
    ecsWorld.addComponent(eid, 'LifeLimited', { lifespan: oldEntity.life, age: oldEntity.age || 0 });
  }

  // Nutrition (food)
  if (oldEntity.nutrition !== undefined) {
    ecsWorld.addComponent(eid, 'Nutrition', { value: oldEntity.nutrition });
  }

  // Death FX tracking
  if (oldEntity._spawnedDeathFx !== undefined) {
    ecsWorld.addComponent(eid, 'DeathFx', { spawned: oldEntity._spawnedDeathFx });
  }

  // Genome
  if (oldEntity.genome) {
    ecsWorld.addComponent(eid, 'Genome', {
      genotype: oldEntity.genome,
      phenotype: oldEntity.phenotype || null,
    });
  }

  // Stressable
  if (speciesType === 'tadpole' || speciesType === 'froglet' ||
      speciesType === 'mosquitoLarva' || speciesType === 'dragonflyNymph' ||
      speciesType === 'frogSpawn' || speciesType === 'mosquitoEgg') {
    const resilience = oldEntity.phenotype?.stressResilience ?? 0.3;
    ecsWorld.addComponent(eid, 'Stressable', { resilience });
  }

  // EdgeSpawn (frog spawn, mosquito eggs — came from edge)
  if (speciesType === 'frogSpawn' || speciesType === 'mosquitoEgg') {
    ecsWorld.addComponent(eid, 'EdgeSpawn', { genotype: oldEntity.genome || null });
  }

  // Store the ECS entity ID on the old entity for position syncing
  oldEntity._ecsEntityId = eid;

  return eid;
}

/** Synchronise an ECS entity's Position from an old entity. */
export function syncPosition(eid, oldEntity) {
  if (!ecsWorld || !eid) return;
  ecsWorld.updateComponent(eid, 'Position', {
    x: oldEntity.x, y: oldEntity.y, vx: oldEntity.vx, vy: oldEntity.vy,
  });
}

/** Map species type to render layer. */
function speciesLayer(type) {
  switch (type) {
    case 'dragonflyAdult': case 'mosquito': return 3;
    case 'froglet': case 'tadpole': case 'dragonflyNymph': return 1;
    case 'food': return 0;
    case 'frogSpawn': case 'mosquitoEgg': case 'mosquitoLarva': return 1;
    case 'particle': return 4;
    default: return 1;
  }
}
