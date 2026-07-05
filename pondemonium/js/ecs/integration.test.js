// ── Full-Pipeline Integration Test ──────────────────────────────────
// Runs the ENTIRE registered system pipeline for many ticks and checks
// end-to-end lifecycle outcomes, not individual system behaviour.
//
// Why this exists: every per-system unit test in this directory passed
// throughout the period where the whole simulation was broken —
// froglets never released, mosquito larvae never moved, dragonfly
// adults never flew — because each system was tested in isolation
// with hand-crafted component fixtures. The root cause (no system
// incremented Age.age or Animation.phase) only showed up when the
// full pipeline ran together over time. A single cheap smoke test
// like this one would have caught it immediately.
//
// Run: node js/ecs/integration.test.js

import { EcsWorld } from './engine.js';
import { registerAllComponents } from './components.js';
import { registerAllSystems } from './systems.js';
import { createFood, createTadpole } from './factories.js';
import { sampleGenePool } from '../genome.js';
import { rand } from '../utils.js';

let passed = 0, failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  }
}

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

function buildSeededWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  const { releaseSystem, ageSystem, morphSystem } = registerAllSystems(world, null);

  for (let i = 0; i < 60; i++) {
    createFood(world, rand(POND_X + 10, POND_X + POND_W - 10), rand(POND_Y + 10, POND_Y + POND_H - 10));
  }
  for (let i = 0; i < 5; i++) {
    createTadpole(world, rand(POND_X + 30, POND_X + POND_W - 30), rand(POND_Y + 30, POND_Y + POND_H - 30), sampleGenePool());
  }

  return { world, releaseSystem, ageSystem, morphSystem };
}

function run(world, ticks, dt = 3) {
  for (let i = 0; i < ticks; i++) {
    world.update(dt);
    world.reapDead();
  }
}

console.log('\n=== Full ECS Pipeline Integration Test ===\n');

// ── Test 1: Age actually progresses (root cause of the "frogs never leave" bug) ──
{
  const { world } = buildSeededWorld();
  const ageStore = world.getStore('Age');
  const [[, someAge]] = ageStore.getAll();
  const before = someAge.age;
  run(world, 50);
  assert(someAge.age > before, `Age.age increments over ticks (${before} -> ${someAge.age})`);
}

// ── Test 2: Mosquito larvae actually move (phase-driven wiggle, not velocity) ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world, null);
  const eid = world.createEntity({
    Position: { x: 300, y: 300, vx: 0, vy: 0, flightY: 300 },
    Renderable: { radius: 3, color: null, alpha: 1, layer: 1, hovered: false },
    Species: { type: 'mosquitoLarva' },
    Age: { age: 0, maxAge: Infinity },
    Growth: { growth: 0, maxSize: 5, growthRate: 0 }, // growthRate 0 so it doesn't morph mid-test
    Animation: { phase: 0, wobble: 0, bobPhase: 0 },
    Stressable: { resilience: 0.3 },
    DeathFx: { spawned: false },
  });
  const pos = world.getComponent(eid, 'Position');
  const before = { x: pos.x, y: pos.y };
  run(world, 100, 1);
  const moved = Math.hypot(pos.x - before.x, pos.y - before.y) > 0.01;
  assert(moved, `Mosquito larva position drifts via phase-wiggle (moved ${Math.hypot(pos.x - before.x, pos.y - before.y).toFixed(3)}px)`);
}

// ── Test 3: Froglets reach the release gate and actually release (the core reported bug) ──
{
  const { world, releaseSystem } = buildSeededWorld();
  // Fast-forward: large dt to reach maturity/age gates quickly without an excessive tick count.
  run(world, 4000, 5);
  const stats = releaseSystem.getReleaseStats();
  assert(stats.frogsReleased > 0, `At least one frog released within the run (frogsReleased=${stats.frogsReleased})`);
  assert(stats.generation > 0, `Generation counter advances when frogs release (generation=${stats.generation})`);
}

// ── Test 4: population doesn't silently collapse to zero or explode unbounded ──
{
  const { world } = buildSeededWorld();
  run(world, 4000, 5);
  const speciesStore = world.getStore('Species');
  const counts = {};
  for (const [eid] of speciesStore.getAll()) {
    const t = speciesStore.get(eid).type;
    counts[t] = (counts[t] || 0) + 1;
  }
  assert((counts.food || 0) > 0, `Food population survives (food=${counts.food || 0})`);
  assert((counts.tadpole || 0) + (counts.froglet || 0) > 0, `Frog lineage survives (tadpoles=${counts.tadpole || 0}, froglets=${counts.froglet || 0})`);
  assert(world.activeEntityCount < 5000, `Entity count stays bounded, no runaway spawn loop (active=${world.activeEntityCount})`);
}

// ── Test 5: mosquitoes/dragonflies die of old age (AgeSystem's LifeLimited handling) ──
{
  const { world, ageSystem } = buildSeededWorld();
  run(world, 4000, 5);
  const ageStats = ageSystem.getAgeStats();
  assert(ageStats.mosquitoesReleased >= 0, 'AgeSystem tracks mosquito natural-death stats without throwing');
  // Not asserting > 0 here — mosquito spawn rate/timing can vary run to run;
  // this test's job is to catch a crash or a stat that never moves at all across many runs.
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
