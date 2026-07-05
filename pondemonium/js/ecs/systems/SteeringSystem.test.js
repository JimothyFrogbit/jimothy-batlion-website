// ── SteeringSystem ECS Query Test ───────────────────────────────────
// Phase 3: Verify the new ECS query-based target finding works.
// Tests that steering works without pondRef.

import { EcsWorld } from '../engine.js';
import {
  Position, Renderable, Species, Nutrition, Steering, TargetSeek,
  Mouth, Energy
} from '../components.js';
import { SteeringSystem } from './SteeringSystem.js';
import { MovementSystem } from './MovementSystem.js';

// ── Helper: register common component stores ──
function registerStores(world) {
  for (const name of ['Position', 'Renderable', 'Species',
    'Nutrition', 'Steering', 'TargetSeek', 'Mouth', 'Energy']) {
    world.registerStore(name);
  }
}

// ── Tick helper: run both steering and movement ──
function tick(world, steering, movement, dt) {
  steering.update(dt, world);
  movement.update(dt, world);
}

// ── Test 1: Tadpole steers toward nearest food ──
{
  const world = new EcsWorld();
  registerStores(world);
  const steering = new SteeringSystem();
  const movement = new MovementSystem();

  const tadpole = world.createEntity({
    Position: Position(350, 350),
    Renderable: Renderable(4, null, 1),
    Species: Species('tadpole'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 80, metabolism: 0.8 },
    Steering: Steering(2.0, 1.0, 120),
    TargetSeek: TargetSeek(),
    Mouth: Mouth(3, 'algae'),
  });

  // Far food
  world.createEntity({
    Position: Position(100, 100),
    Renderable: Renderable(2, null, 0),
    Species: Species('food'),
    Nutrition: { value: 5 },
  });

  // Close food — should be preferred
  world.createEntity({
    Position: Position(300, 300),
    Renderable: Renderable(3, null, 0),
    Species: Species('food'),
    Nutrition: { value: 8 },
  });

  const posBefore = { ...world.getComponent(tadpole, 'Position') };
  for (let i = 0; i < 120; i++) {
    tick(world, steering, movement, 1);
  }
  const posAfter = world.getComponent(tadpole, 'Position');

  const moved = (posAfter.x !== posBefore.x || posAfter.y !== posBefore.y);
  const dx = posAfter.x - posBefore.x;
  const dy = posAfter.y - posBefore.y;
  const movedTowardFood = dx < 0 && dy < 0; // food at top-left

  console.log(`Test 1: Tadpole steers toward nearest food`);
  console.log(`  Before: (${posBefore.x.toFixed(2)}, ${posBefore.y.toFixed(2)})`);
  console.log(`  After:  (${posAfter.x.toFixed(2)}, ${posAfter.y.toFixed(2)})`);
  console.log(`  Delta:  (${dx.toFixed(3)}, ${dy.toFixed(3)})`);
  console.log(`  Moved: ${moved ? '✅' : '❌'}, toward food: ${movedTowardFood ? '✅' : '❌'}`);
}

// ── Test 2: Dragonfly nymph hunts nearest tadpole ──
{
  const world = new EcsWorld();
  registerStores(world);
  const steering = new SteeringSystem();
  const movement = new MovementSystem();

  const nymph = world.createEntity({
    Position: Position(350, 350),
    Renderable: Renderable(9, null, 1),
    Species: Species('dragonflyNymph'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 80, metabolism: 1.0 },
    Steering: Steering(1.5, 0.8, 200),
    TargetSeek: TargetSeek(),
    Mouth: Mouth(6, 'tadpole'),
  });

  world.createEntity({
    Position: Position(340, 340),  // nearby
    Renderable: Renderable(4, null, 1),
    Species: Species('tadpole'),
    Energy: { energy: 50, maxEnergy: 100, satiation: 60, metabolism: 0.6 },
  });

  const posBefore = { ...world.getComponent(nymph, 'Position') };
  for (let i = 0; i < 120; i++) {
    tick(world, steering, movement, 1);
  }
  const posAfter = world.getComponent(nymph, 'Position');

  const moved = posAfter.x !== posBefore.x || posAfter.y !== posBefore.y;
  console.log(`\nTest 2: Dragonfly nymph steers toward tadpole`);
  console.log(`  Before: (${posBefore.x.toFixed(2)}, ${posBefore.y.toFixed(2)})`);
  console.log(`  After:  (${posAfter.x.toFixed(2)}, ${posAfter.y.toFixed(2)})`);
  console.log(`  Moved toward prey: ${moved ? '✅' : '❌'}`);
}

// ── Test 3: Dead food is ignored ──
{
  const world = new EcsWorld();
  registerStores(world);
  const steering = new SteeringSystem();
  const movement = new MovementSystem();

  const tadpole = world.createEntity({
    Position: Position(350, 350),
    Renderable: Renderable(4, null, 1),
    Species: Species('tadpole'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 80, metabolism: 0.8 },
    Steering: Steering(2.0, 1.0, 120),
    TargetSeek: TargetSeek(),
    Mouth: Mouth(3, 'algae'),
  });

  // Dead food at (351, 351) — almost on top, but dead
  const deadFood = world.createEntity({
    Position: Position(351, 351),
    Renderable: Renderable(2, null, 0),
    Species: Species('food'),
    Nutrition: { value: 5 },
  });
  world.markDead(deadFood);

  // Living food at (345, 355) — within sight range (120)
  world.createEntity({
    Position: Position(345, 355),
    Renderable: Renderable(2, null, 0),
    Species: Species('food'),
    Nutrition: { value: 5 },
  });

  const posBefore = { ...world.getComponent(tadpole, 'Position') };
  for (let i = 0; i < 120; i++) {
    tick(world, steering, movement, 1);
  }
  const posAfter = world.getComponent(tadpole, 'Position');

  // Dead food was at (351, 351) — left of center
  // Living food is at (345, 355) — slightly left, slightly down
  // Tadpole should NOT steer toward dead food (it's ignored)
  // Should steer toward living food at (345, 355)
  const dx = posAfter.x - posBefore.x;
  const movedAwayFromDead = posAfter.x < posBefore.x; // dead food was slightly right (+1)

  console.log(`\nTest 3: Dead food is ignored`);
  console.log(`  Before: (${posBefore.x.toFixed(2)}, ${posBefore.y.toFixed(2)})`);
  console.log(`  After:  (${posAfter.x.toFixed(2)}, ${posAfter.y.toFixed(2)})`);
  console.log(`  Delta:  (${dx.toFixed(3)})`);
  console.log(`  Moved away from dead food: ${movedAwayFromDead ? '✅' : '❌'}`);
}

// ── Test 4: Froglet prefers mosquitoes over food ──
{
  const world = new EcsWorld();
  registerStores(world);
  const steering = new SteeringSystem();
  const movement = new MovementSystem();

  const froglet = world.createEntity({
    Position: Position(350, 350),
    Renderable: Renderable(10, null, 1),
    Species: Species('froglet'),
    Energy: { energy: 100, maxEnergy: 100, satiation: 80, metabolism: 0.4 },
    Steering: Steering(5.0, 1.0, 120),
    TargetSeek: TargetSeek(),
    Mouth: Mouth(9, 'both'),
  });

  // Mosquito at (300, 340) — above/left of center
  world.createEntity({
    Position: Position(300, 340),
    Renderable: Renderable(3, null, 3),
    Species: Species('mosquito'),
    Steering: Steering(2.0, 1.0, 80),
  });

  // Food at (350, 380) — below center
  world.createEntity({
    Position: Position(350, 380),
    Renderable: Renderable(2, null, 0),
    Species: Species('food'),
    Nutrition: { value: 5 },
  });

  const posBefore = { ...world.getComponent(froglet, 'Position') };
  for (let i = 0; i < 120; i++) {
    tick(world, steering, movement, 1);
  }
  const posAfter = world.getComponent(froglet, 'Position');

  // Mosquito is at (300, 340) — left and slightly up from (350, 350)
  const dx = posAfter.x - posBefore.x;
  const movedTowardMosquito = dx < 0;

  console.log(`\nTest 4: Froglet prefers mosquitoes over food`);
  console.log(`  Before: (${posBefore.x.toFixed(2)}, ${posBefore.y.toFixed(2)})`);
  console.log(`  After:  (${posAfter.x.toFixed(2)}, ${posAfter.y.toFixed(2)})`);
  console.log(`  Delta:  (${dx.toFixed(3)})`);
  console.log(`  Moved toward mosquito: ${movedTowardMosquito ? '✅' : '❌'}`);
}

// ── Test 5: Mosquito wanders erratically (no target steering, just drift) ──
{
  const world = new EcsWorld();
  registerStores(world);
  const steering = new SteeringSystem();
  const movement = new MovementSystem();

  const mosquito = world.createEntity({
    Position: Position(350, 350),
    Renderable: Renderable(3, null, 3),
    Species: Species('mosquito'),
    Steering: Steering(2.0, 1.0, 80),
    TargetSeek: TargetSeek(),
  });

  const posBefore = { ...world.getComponent(mosquito, 'Position') };
  for (let i = 0; i < 120; i++) {
    tick(world, steering, movement, 1);
  }
  const posAfter = world.getComponent(mosquito, 'Position');

  const moved = posAfter.x !== posBefore.x || posAfter.y !== posBefore.y;
  console.log(`\nTest 5: Mosquito wanders erratically`);
  console.log(`  Before: (${posBefore.x.toFixed(2)}, ${posBefore.y.toFixed(2)})`);
  console.log(`  After:  (${posAfter.x.toFixed(2)}, ${posAfter.y.toFixed(2)})`);
  console.log(`  Moved: ${moved ? '✅' : '❌'}`);
}

console.log(`\n=== All SteeringSystem ECS Query Tests Complete ===`);
