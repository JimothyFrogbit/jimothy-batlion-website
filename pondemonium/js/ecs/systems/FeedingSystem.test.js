// ── FeedingSystem Test (Phase 3: ECS Query) ─────────────────────────
// Verifies that FeedingSystem correctly finds food and prey via ECS
// component queries (no pondRef).
//
//   1. Tadpole eats nearby food (algae)
//   2. Froglet eats nearby mosquito (prefers over food)
//   3. Froglet eats algae when no mosquito nearby
//   4. Dragonfly nymph hunts nearby tadpole
//   5. Dragonfly nymph hunts nearby mosquito larva
//   6. Satiation is updated correctly
//   7. Eaten prey is marked dead

import { EcsWorld } from '../engine.js';
import {
  registerAllComponents, Position, Species, Energy, Renderable,
  Nutrition, Mouth, Steering, TargetSeek, Growth
} from '../components.js';
import { FeedingSystem } from './FeedingSystem.js';

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

// ── Test 1: Tadpole eats nearby food ──
{
  console.log('\n📋 Test 1: Tadpole eats nearby food (ECS query)');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const tadpole = world.createEntity({
    Position: Position(100, 100),
    Species: Species('tadpole'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 60, metabolism: 0.8 },
    Mouth: Mouth(3, 'algae'),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  // Food entity within range
  const foodEid = world.createEntity({
    Position: Position(103, 100),
    Species: Species('food'),
    Nutrition: Nutrition(5),
    Renderable: Renderable(2, '#44aa44', 0),
  });

  const energyBefore = { ...world.getComponent(tadpole, 'Energy') };

  system.update(1, world);

  const energyAfter = world.getComponent(tadpole, 'Energy');
  const satGained = energyAfter.satiation - energyBefore.satiation;
  assert(satGained > 0, `Tadpole gained satiation (${satGained.toFixed(1)})`);
  assert(!world.hasEntity(foodEid), 'Food entity was marked dead after eating');
  assert(world.hasEntity(tadpole), 'Tadpole is still alive');
}

// ── Test 2: Froglet eats mosquito (prefers over food) ──
{
  console.log('\n📋 Test 2: Froglet prefers mosquito over food');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const froglet = world.createEntity({
    Position: Position(200, 200),
    Species: Species('froglet'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 50, metabolism: 0.4 },
    Mouth: Mouth(9, 'both'),
    Renderable: Renderable(10, '#88cc44', 1),
  });

  // Mosquito at (205, 190) — within froglet leap range (dy: -30 to +10)
  const mosquitoEid = world.createEntity({
    Position: Position(205, 190),
    Species: Species('mosquito'),
    Renderable: Renderable(3, '#cc8844', 3),
  });

  // Food closer at (202, 200) but froglet should prefer mosquito
  const foodEid = world.createEntity({
    Position: Position(202, 200),
    Species: Species('food'),
    Nutrition: Nutrition(5),
    Renderable: Renderable(2, '#44aa44', 0),
  });

  const energyBefore = { ...world.getComponent(froglet, 'Energy') };

  system.update(1, world);

  const energyAfter = world.getComponent(froglet, 'Energy');
  const satGained = energyAfter.satiation - energyBefore.satiation;
  assert(satGained >= 20, `Froglet gained satiation (${satGained.toFixed(1)}) from mosquito`);
  assert(!world.hasEntity(mosquitoEid), 'Mosquito was marked dead (froglet ate it)');
  assert(world.hasEntity(foodEid), 'Food still alive (froglet chose mosquito)');
}

// ── Test 3: Froglet eats algae when no mosquito ──
{
  console.log('\n📋 Test 3: Froglet eats algae (no mosquito nearby)');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const froglet = world.createEntity({
    Position: Position(300, 300),
    Species: Species('froglet'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 50, metabolism: 0.4 },
    Mouth: Mouth(9, 'both'),
    Renderable: Renderable(10, '#88cc44', 1),
  });

  const foodEid = world.createEntity({
    Position: Position(305, 300),
    Species: Species('food'),
    Nutrition: Nutrition(5),
    Renderable: Renderable(2, '#44aa44', 0),
  });

  const energyBefore = { ...world.getComponent(froglet, 'Energy') };

  system.update(1, world);

  const energyAfter = world.getComponent(froglet, 'Energy');
  const satGained = energyAfter.satiation - energyBefore.satiation;
  assert(satGained > 0, `Froglet gained satiation from algae (${satGained.toFixed(1)})`);
  assert(!world.hasEntity(foodEid), 'Food was eaten');
}

// ── Test 4: Dragonfly nymph hunts tadpole ──
{
  console.log('\n📋 Test 4: Dragonfly nymph hunts tadpole');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const nymph = world.createEntity({
    Position: Position(400, 400),
    Species: Species('dragonflyNymph'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 50, metabolism: 1.0 },
    Mouth: Mouth(6, 'tadpole'),
    Predator: { attackCooldown: 0, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Growth: Growth(0, 10, 0.01),
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  const preyEid = world.createEntity({
    Position: Position(404, 400),
    Species: Species('tadpole'),
    Energy: Energy(80, 100),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  const predBefore = { ...world.getComponent(nymph, 'Predator') };
  const energyBefore = { ...world.getComponent(nymph, 'Energy') };

  system.update(1, world);

  const predAfter = world.getComponent(nymph, 'Predator');
  const energyAfter = world.getComponent(nymph, 'Energy');

  assert(!world.hasEntity(preyEid), 'Tadpole prey was killed');
  assert(energyAfter.satiation > energyBefore.satiation, 'Nymph gained satiation');
  assert(predAfter.attackCooldown === 20, 'Nymph cooldown set to 20');
  assert(predAfter.meals === 1, 'Nymph meals incremented to 1');

  // Check particles were spawned
  const particleStore = world.getStore('Species');
  let particleCount = 0;
  if (particleStore) {
    for (const [eid, species] of particleStore.getAll()) {
      if (species.type === 'particle') particleCount++;
    }
  }
  assert(particleCount >= 4, `Death particles spawned (${particleCount})`);
}

// ── Test 5: Dragonfly nymph hunts mosquito larva ──
{
  console.log('\n📋 Test 5: Dragonfly nymph hunts mosquito larva');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const nymph = world.createEntity({
    Position: Position(500, 500),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Mouth: Mouth(6, 'tadpole'),
    Predator: { attackCooldown: 0, meals: 0, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Growth: Growth(0, 10, 0.01),
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  const preyEid = world.createEntity({
    Position: Position(503, 500),
    Species: Species('mosquitoLarva'),
    Energy: Energy(60, 100),
    Renderable: Renderable(3, '#88aa44', 1),
  });

  const growthBefore = { ...world.getComponent(nymph, 'Growth') };
  const predBefore = { ...world.getComponent(nymph, 'Predator') };

  system.update(1, world);

  const growthAfter = world.getComponent(nymph, 'Growth');

  assert(!world.hasEntity(preyEid), 'Mosquito larva was killed');
  assert(growthAfter.growth > growthBefore.growth, 'Nymph gained growth from meal');
  assert(predBefore.meals + 1 === world.getComponent(nymph, 'Predator').meals, 'Meals incremented');
}

// ── Test 6: Nymph with cooldown does not hunt ──
{
  console.log('\n📋 Test 6: Nymph with cooldown skips hunting');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const nymph = world.createEntity({
    Position: Position(600, 600),
    Species: Species('dragonflyNymph'),
    Energy: Energy(100, 100),
    Mouth: Mouth(6, 'tadpole'),
    Predator: { attackCooldown: 15, meals: 1, huntCooldown: 0, preferredPrey: ['tadpole', 'mosquitoLarva'] },
    Growth: Growth(0.5, 10, 0.01),
    Renderable: Renderable(9, '#2d5a27', 1),
  });

  const preyEid = world.createEntity({
    Position: Position(604, 600),
    Species: Species('tadpole'),
    Energy: Energy(80, 100),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  system.update(1, world);

  assert(world.hasEntity(preyEid), 'Tadpole still alive (cooldown active)');
  const predAfter = world.getComponent(nymph, 'Predator');
  assert(predAfter.attackCooldown < 15, 'Cooldown was decremented');
}

// ── Test 7: Too-far food is not eaten ──
{
  console.log('\n📋 Test 7: Far food is not eaten');
  const world = new EcsWorld();
  registerAllComponents(world);
  const system = new FeedingSystem();
  world.addSystem(system);

  const tadpole = world.createEntity({
    Position: Position(10, 10),
    Species: Species('tadpole'),
    Energy: Energy(100, 100),
    Mouth: Mouth(3, 'algae'),
    Renderable: Renderable(4, '#88cc44', 1),
  });

  const foodEid = world.createEntity({
    Position: Position(500, 500),
    Species: Species('food'),
    Nutrition: Nutrition(5),
    Renderable: Renderable(2, '#44aa44', 0),
  });

  const energyBefore = { ...world.getComponent(tadpole, 'Energy') };
  system.update(1, world);
  const energyAfter = world.getComponent(tadpole, 'Energy');

  assert(world.hasEntity(foodEid), 'Far food should still be alive');
  assert(energyAfter.satiation === energyBefore.satiation, 'Satiation unchanged (too far)');
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);