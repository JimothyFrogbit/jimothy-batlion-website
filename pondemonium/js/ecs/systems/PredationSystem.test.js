// ── PredationSystem Test (Phase 3: ECS Query) ───────────────────────
// Verifies that PredationSystem correctly finds and kills prey via ECS
// component queries (no pondRef).
//
//   1. Dragonfly nymph with cooldown 0 kills nearby tadpole
//   2. Dragonfly nymph with cooldown 0 kills nearby mosquito larva
//   3. Dragonfly nymph with active cooldown skips predation
//   4. Tadpole too far away is not killed
//   5. Death particles are spawned for killed prey

import { EcsWorld } from '../engine.js';
import { registerAllComponents, Position, Species, Energy, Renderable } from '../components.js';
import { PredationSystem } from './PredationSystem.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function assertCount(lbl, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${lbl}: ${actual} (expected ${expected})`);
  } else {
    failed++;
    console.log(`  ❌ ${lbl}: got ${actual}, expected ${expected}`);
  }
}

// ── Test 1: Nymph kills nearby tadpole via ECS query ──
{
  console.log('\n📋 Test 1: Nymph kills nearby tadpole (ECS query)');
  const world = new EcsWorld();
  registerAllComponents(world);

  const system = new PredationSystem();
  world.addSystem(system);

  // Create nymph (predator)
  world.createEntity({
    Position: Position(100, 100),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Predator: { attackCooldown: 0, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  // Create prey tadpole close to nymph (pure ECS — no old entity)
  const preyEid = world.createEntity({
    Position: Position(104, 100),
    Species: Species('tadpole'),
    Energy: Energy(100, 100),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  // Run update
  system.update(1, world);

  // Check prey was marked dead via ECS
  const preyStillAlive = world.hasEntity(preyEid);
  assert(!preyStillAlive, `Tadpole should be dead (was alive: ${preyStillAlive})`);

  // Check particles were spawned (4 particles)
  const particleStore = world.getStore('Species');
  let particleCount = 0;
  if (particleStore) {
    for (const [eid, species] of particleStore.getAll()) {
      if (species.type === 'particle') particleCount++;
    }
  }
  assert(particleCount === 4, `Should have 4 death particles (got ${particleCount})`);
}

// ── Test 2: Nymph kills nearby mosquito larva via ECS query ──
{
  console.log('\n📋 Test 2: Nymph kills nearby mosquito larva (ECS query)');
  const world = new EcsWorld();
  registerAllComponents(world);

  const system = new PredationSystem();
  world.addSystem(system);

  // Create nymph
  world.createEntity({
    Position: Position(200, 200),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Predator: { attackCooldown: 0, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  // Create mosquito larva prey close to nymph (pure ECS)
  const preyEid = world.createEntity({
    Position: Position(203, 200),
    Species: Species('mosquitoLarva'),
    Energy: Energy(100, 100),
    Renderable: Renderable(3, '#88aa44', 1),
  });

  system.update(1, world);

  // Check prey was marked dead
  const preyStillAlive = world.hasEntity(preyEid);
  assert(!preyStillAlive, `Mosquito larva should be dead (was alive: ${preyStillAlive})`);

  // Check particles
  const particleStore = world.getStore('Species');
  let particleCount = 0;
  if (particleStore) {
    for (const [eid, species] of particleStore.getAll()) {
      if (species.type === 'particle') particleCount++;
    }
  }
  assert(particleCount === 4, `Should have 4 death particles (got ${particleCount})`);
}

// ── Test 3: Nymph with active cooldown does NOT kill ──
{
  console.log('\n📋 Test 3: Nymph with cooldown skips predation');
  const world = new EcsWorld();
  registerAllComponents(world);

  const system = new PredationSystem();
  world.addSystem(system);

  // Create nymph with active cooldown
  world.createEntity({
    Position: Position(300, 300),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Predator: { attackCooldown: 15, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  // Create tadpole close enough to trigger if cooldown were 0
  const preyEid = world.createEntity({
    Position: Position(304, 300),
    Species: Species('tadpole'),
    Energy: Energy(100, 100),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  system.update(1, world);

  // Prey should still be alive
  const preyStillAlive = world.hasEntity(preyEid);
  assert(preyStillAlive, `Tadpole should still be alive (was alive: ${preyStillAlive})`);
}

// ── Test 4: Tadpole too far away is not killed ──
{
  console.log('\n📋 Test 4: Tadpole out of range is not killed');
  const world = new EcsWorld();
  registerAllComponents(world);

  const system = new PredationSystem();
  world.addSystem(system);

  // Create nymph
  world.createEntity({
    Position: Position(400, 400),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Predator: { attackCooldown: 0, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  // Create tadpole far away
  const preyEid = world.createEntity({
    Position: Position(600, 600),
    Species: Species('tadpole'),
    Energy: Energy(100, 100),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  system.update(1, world);

  const preyStillAlive = world.hasEntity(preyEid);
  assert(preyStillAlive, `Distant tadpole should still be alive`);
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
