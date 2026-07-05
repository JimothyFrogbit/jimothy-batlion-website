// ── ECS Performance Benchmark ────────────────────────────────────────
// Fast-forwards a seeded world to a realistic mid/late-session
// population, then times N ticks. Use this to catch performance
// regressions before they ship — a change that looks correct in the
// unit tests can still make every tick 5x slower (this is exactly how
// the SteeringSystem/FeedingSystem O(hunters × prey) scan was found:
// profiled per-system, both were ~3.3ms/tick out of a ~6.15ms total at
// ~440 entities, fixed by adding a spatial grid — see spatialGrid.js).
//
// Run: node js/ecs/perf-bench.mjs

import { EcsWorld } from './engine.js';
import { registerAllComponents } from './components.js';
import { registerAllSystems } from './systems.js';
import { createFood, createTadpole } from './factories.js';
import { sampleGenePool } from '../genome.js';
import { rand } from '../utils.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

function buildWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world, null);
  for (let i = 0; i < 200; i++) createFood(world, rand(POND_X + 10, POND_X + POND_W - 10), rand(POND_Y + 10, POND_Y + POND_H - 10));
  for (let i = 0; i < 40; i++) createTadpole(world, rand(POND_X + 30, POND_X + POND_W - 30), rand(POND_Y + 30, POND_Y + POND_H - 30), sampleGenePool());
  return world;
}

function speciesCounts(world) {
  const sp = world.getStore('Species');
  const counts = {};
  for (const [eid] of sp.getAll()) {
    const t = sp.get(eid).type;
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

function benchmark(label, warmupTicks, timedTicks) {
  const world = buildWorld();
  for (let i = 0; i < warmupTicks; i++) { world.update(5); world.reapDead(); }

  console.log(`\n=== ${label} ===`);
  console.log('population:', speciesCounts(world), 'total active:', world.activeEntityCount);

  const t0 = performance.now();
  for (let i = 0; i < timedTicks; i++) { world.update(2); world.reapDead(); }
  const t1 = performance.now();
  const perTick = (t1 - t0) / timedTicks;
  console.log(`${timedTicks} ticks in ${(t1 - t0).toFixed(1)}ms -> ${perTick.toFixed(3)}ms/tick`);
  return perTick;
}

benchmark('Mid-session population (default rates, 3000-tick warmup)', 3000, 500);
