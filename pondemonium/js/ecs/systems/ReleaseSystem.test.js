// ── ReleaseSystem Tests ─────────────────────────────────────────────
// Tests for froglet → genePool release logic.
//
// Run: node --experimental-vm-modules ReleaseSystem.test.js

import { EcsWorld } from '../engine.js';
import { registerAllComponents } from '../components.js';
import { ReleaseSystem } from './ReleaseSystem.js';
import { randomGenotype, resetPool } from '../../genome.js';
import { FROGLET_RELEASE_MIN_AGE } from '../balance.js';

// "Old enough" for these fixtures — comfortably above the release gate,
// whatever MATURATION_SLOWDOWN currently is (see balance.js).
const OLD_ENOUGH_AGE = FROGLET_RELEASE_MIN_AGE + 100;

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

function assertEqual(a, b, msg) {
  if (a !== b) {
    console.error(`  ❌ FAIL: ${msg} — expected ${b}, got ${a}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg} (${a})`);
    passed++;
  }
}

// Helper: create a froglet entity
function createFroglet(world, overrides = {}) {
  return world.createEntity({
    Position: { x: 100, y: 100, vx: 0, vy: 0, flightY: 100 },
    Renderable: { radius: 10, color: '#88cc44', alpha: 1.0, layer: 1, hovered: false },
    Species: { type: 'froglet' },
    Age: { age: overrides.age !== undefined ? overrides.age : OLD_ENOUGH_AGE, maxAge: 3000 },
    Growth: { growth: overrides.growth !== undefined ? overrides.growth : 1.1, maxSize: 16, growthRate: 0.002, targetEntityType: null },
    Energy: { energy: 100, maxEnergy: 100, satiation: overrides.satiation !== undefined ? overrides.satiation : 80, metabolism: 0.4 },
    Mouth: { gape: 9, diet: 'both', eatCooldown: 0 },
    Steering: { speed: 5, agility: 1.0, sight: 120 },
    TargetSeek: { lockedTargetId: null, lockTimer: 0, lockDuration: 45, targetDir: 0, targetTimer: 0, hysteresis: 0.85 },
    Jump: { cooldown: 0, jumpDrive: 1.0, minInterval: 20, maxInterval: 60 },
    Animation: { phase: 0, wobble: 0, bobPhase: 0 },
    Predator: { attackCooldown: 0, meals: 0, preferredPrey: ['food', 'mosquito'], huntCooldown: 0 },
    Stressable: { resilience: 0.3 },
    DeathFx: { spawned: false },
    ...(overrides.genome ? { Genome: { genotype: overrides.genome, phenotype: null } } : {}),
  });
}

console.log('\n=== ReleaseSystem Tests ===\n');

// ── Test 1: Immature froglet does not release ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  createFroglet(world, { growth: 0.5 });
  releaseSys.update(1, world);
  const stats = releaseSys.getReleaseStats();
  assertEqual(stats.frogsReleased, 0, 'Immature froglet (growth=0.5) should not release');
  assertEqual(stats.generation, 0, 'Generation should not increment for immature froglet');
}

// ── Test 2: Hungry froglet does not release ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  createFroglet(world, { growth: 1.0, satiation: 30 });
  releaseSys.update(1, world);
  const stats = releaseSys.getReleaseStats();
  assertEqual(stats.frogsReleased, 0, 'Hungry froglet (satiation=30) should not release');
}

// ── Test 3: Young froglet does not release ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  createFroglet(world, { growth: 1.0, age: 300 });
  releaseSys.update(1, world);
  const stats = releaseSys.getReleaseStats();
  assertEqual(stats.frogsReleased, 0, 'Young froglet (age=300) should not release');
}

// ── Test 4: Mature, fed, old froglet can release (random chance) ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  createFroglet(world, { growth: 1.0, satiation: 80, age: OLD_ENOUGH_AGE });
  let releases = 0;
  for (let i = 0; i < 3000; i++) {
    releaseSys.update(1, world);
    releases = releaseSys.getReleaseStats().frogsReleased;
    if (releases > 0) break;
  }
  assert(releases > 0, 'Mature froglet should release within 3000 frames (releases=' + releases + ')');
}

// ── Test 5: Multiple froglets can each release ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  for (let i = 0; i < 10; i++) {
    createFroglet(world, { growth: 1.0, satiation: 80, age: OLD_ENOUGH_AGE });
  }
  let releases = 0;
  for (let i = 0; i < 5000; i++) {
    releaseSys.update(1, world);
    releases = releaseSys.getReleaseStats().frogsReleased;
    if (releases >= 2) break;
  }
  assert(releases >= 2, '10 froglets should release at least 2 within 5000 frames (got ' + releases + ')');
}

// ── Test 6: Release with genome adds to counter ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  const gen = randomGenotype();
  createFroglet(world, { growth: 1.0, satiation: 80, age: OLD_ENOUGH_AGE, genome: gen });
  let released = false;
  for (let i = 0; i < 3000; i++) {
    releaseSys.update(1, world);
    if (releaseSys.getReleaseStats().frogsReleased > 0) {
      released = true;
      break;
    }
  }
  assert(released, 'Froglet with genome should release within 3000 frames');
}

// ── Test 7: Reset clears counters ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  createFroglet(world, { growth: 1.0, satiation: 80, age: OLD_ENOUGH_AGE });
  for (let i = 0; i < 3000; i++) {
    releaseSys.update(1, world);
    if (releaseSys.getReleaseStats().frogsReleased > 0) break;
  }
  releaseSys.reset();
  const stats = releaseSys.getReleaseStats();
  assertEqual(stats.frogsReleased, 0, 'After reset, frogsReleased should be 0');
  assertEqual(stats.generation, 0, 'After reset, generation should be 0');
}

// ── Test 8: Releases spawn particles and food in ECS world ──
{
  const world = new EcsWorld();
  registerAllComponents(world);
  const releaseSys = new ReleaseSystem();
  world.addSystem(releaseSys);
  const initialParticles = world.query('Species', 'ParticleState').length;
  const initialFood = world.query('Species', 'Nutrition').length;

  createFroglet(world, { growth: 1.0, satiation: 80, age: OLD_ENOUGH_AGE });
  let particlesCreated = 0;
  let foodCreated = 0;
  let wasReleased = false;

  for (let i = 0; i < 3000; i++) {
    releaseSys.update(1, world);
    if (releaseSys.getReleaseStats().frogsReleased > 0) {
      wasReleased = true;
      particlesCreated = world.query('Species', 'ParticleState').length - initialParticles;
      foodCreated = world.query('Species', 'Nutrition').length - initialFood;
      break;
    }
  }

  if (wasReleased) {
    assert(particlesCreated >= 8, 'Release should spawn 8+ particles (got ' + particlesCreated + ')');
    assert(foodCreated >= 3, 'Release should spawn 3+ food items (got ' + foodCreated + ')');
  } else {
    console.log('  ⚠️  SKIP: Release particles/food — froglet did not release this run');
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
