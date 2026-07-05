// ── MorphSystem Test ─────────────────────────────────────────────────
// Verifies that MorphSystem correctly transforms mature entities:
//   1. Tadpole (growth >= 1) → Froglet (spawned, old dead)
//   2. MosquitoLarva (growth >= 1) → Mosquito (spawned, old dead)
//   3. Immature entities are NOT transformed
//   4. Morph particles are spawned
//
// Run: node --experimental-vm-modules MorphSystem.test.js  (or via test runner)
// Manual: node tests/ecs-morph.js

import { EcsWorld } from '../engine.js';
import { registerAllComponents } from '../components.js';
import { MorphSystem } from './MorphSystem.js';

// ── Helpers ──────────────────────────────────────────────────────────

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg}`);
  }
}

function assertEqual(a, b, msg) {
  if (a !== b) {
    console.error(`  ❌ FAIL: ${msg} — expected ${b}, got ${a}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg} (${a})`);
  }
}

function assertNear(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) {
    console.error(`  ❌ FAIL: ${msg} — expected ~${b}, got ${a}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASS: ${msg} (${a})`);
  }
}

function setupWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  world.addSystem(new MorphSystem());
  return world;
}

// ── Tests ────────────────────────────────────────────────────────────

console.log('\n=== MorphSystem Tests ===\n');

// Test 1: Tadpole at growth=1 morphs into Froglet
(function testTadpoleMorphsToFroglet() {
  const world = setupWorld();

  // Create a mature tadpole
  const eid = world.createEntity({
    Position: { x: 100, y: 200, vx: 0, vy: 0 },
    Renderable: { radius: 14, color: '#88cc44', alpha: 1.0, layer: 1 },
    Species: { type: 'tadpole' },
    Age: { age: 500, maxAge: 2000 },
    Growth: { growth: 1.0, maxSize: 16, growthRate: 0.003 },
    Energy: { energy: 80, maxEnergy: 100, satiation: 70, metabolism: 0.5 },
    Mouth: { gape: 5, diet: 'algae', eatCooldown: 0 },
    Steering: { speed: 1.5, agility: 1.0, sight: 80 },
    TargetSeek: {},
    Animation: { phase: 1.0 },
    Predator: {},
    Stressable: { resilience: 0.3 },
    DeathFx: { spawned: false },
  });

  // Add genome
  const testGenome = {
    genotype: { MC1R: 0.7, THR: 0.5, BMP: 0.8 },
    phenotype: { bodySize: 20, colorHue: 120 },
  };
  world.addComponent(eid, 'Genome', { ...testGenome });

  // Run morph system
  world.update(1);

  // The tadpole should be dead
  assert(!world.hasEntity(eid), 'Tadpole marked dead after morph');

  // A froglet should exist
  const froglets = world.query('Species', 'Growth');
  assert(froglets.length >= 1, 'At least one entity with Species+Growth after morph');

  let frogletId = null;
  for (const fid of froglets) {
    const species = world.getComponent(fid, 'Species');
    if (species.type === 'froglet') {
      frogletId = fid;
      break;
    }
  }
  assert(frogletId !== null, 'A Froglet entity was created');

  // Froglet should have Froglet-specific components
  if (frogletId) {
    const pos = world.getComponent(frogletId, 'Position');
    assertNear(pos.x, 100, 0.1, 'Froglet inherits X position');
    assertNear(pos.y, 200, 0.1, 'Froglet inherits Y position');

    const renderable = world.getComponent(frogletId, 'Renderable');
    assertNear(renderable.radius, 10, 0.1, 'Froglet starts at radius 10');

    const jump = world.getComponent(frogletId, 'Jump');
    assert(jump !== null, 'Froglet has Jump component');

    const targetSeek = world.getComponent(frogletId, 'TargetSeek');
    assert(targetSeek !== null, 'Froglet has TargetSeek component');

    const energy = world.getComponent(frogletId, 'Energy');
    assertEqual(energy.satiation, 80, 'Froglet starts at 80 satiation');
    assertEqual(energy.metabolism, 0.4, 'Froglet metabolism is 0.4');

    // Genome should be inherited
    const inheritedGenome = world.getComponent(frogletId, 'Genome');
    assert(inheritedGenome !== null, 'Froglet inherits Genome from tadpole');
    if (inheritedGenome) {
      assertEqual(inheritedGenome.genotype.MC1R, 0.7, 'Genome MC1R inherited');
      assertEqual(inheritedGenome.phenotype.bodySize, 20, 'Phenotype bodySize inherited');
    }
  }

  // Particles should have been spawned
  const particles = world.query('Species', 'ParticleState');
  assert(particles.length >= 4, 'Morph particles spawned for tadpole→froglet');
})();

// Test 2: MosquitoLarva at growth=1 morphs into Mosquito
(function testLarvaMorphsToMosquito() {
  const world = setupWorld();

  const eid = world.createEntity({
    Position: { x: 300, y: 400, vx: 0, vy: 0 },
    Renderable: { radius: 5, color: '#88cc44', alpha: 1.0, layer: 1 },
    Species: { type: 'mosquitoLarva' },
    Age: { age: 150, maxAge: 500 },
    Growth: { growth: 1.0, maxSize: 5, growthRate: 0.004 },
    Animation: { phase: 2.0 },
    Predator: {},
    Stressable: { resilience: 0.2 },
    DeathFx: { spawned: false },
  });

  world.update(1);

  // Larva should be dead
  assert(!world.hasEntity(eid), 'MosquitoLarva marked dead after morph');

  // A mosquito should exist
  const mosquitoes = world.query('Species', 'Flight');
  assert(mosquitoes.length >= 1, 'At least one entity with Species+Flight after morph');

  let mosquitoId = null;
  for (const mid of mosquitoes) {
    const species = world.getComponent(mid, 'Species');
    if (species.type === 'mosquito') {
      mosquitoId = mid;
      break;
    }
  }
  assert(mosquitoId !== null, 'A Mosquito entity was created');

  if (mosquitoId) {
    const flight = world.getComponent(mosquitoId, 'Flight');
    assert(flight !== null, 'Mosquito has Flight component');

    const lifeLimited = world.getComponent(mosquitoId, 'LifeLimited');
    assert(lifeLimited !== null, 'Mosquito has LifeLimited component');
    assertEqual(lifeLimited.lifespan, 400, 'Mosquito lifespan is 400');

    const renderable = world.getComponent(mosquitoId, 'Renderable');
    assertNear(renderable.radius, 3, 0.1, 'Mosquito starts at radius 3');
    assertEqual(renderable.layer, 3, 'Mosquito is on flying layer');
  }

  // Particles should have been spawned
  const particles = world.query('Species', 'ParticleState');
  assert(particles.length >= 3, 'Morph particles spawned for larva→mosquito');
})();

// Test 3: Immature entities are NOT transformed
(function testImmatureEntityNotMorphed() {
  const world = setupWorld();

  const eid = world.createEntity({
    Position: { x: 50, y: 50, vx: 0, vy: 0 },
    Renderable: { radius: 6, color: '#88cc44', alpha: 1.0, layer: 1 },
    Species: { type: 'tadpole' },
    Age: { age: 50, maxAge: 2000 },
    Growth: { growth: 0.5, maxSize: 16, growthRate: 0.003 },
    Energy: { energy: 100, maxEnergy: 100, satiation: 90, metabolism: 0.5 },
    Mouth: { gape: 5, diet: 'algae', eatCooldown: 0 },
    Steering: { speed: 1.5, agility: 1.0, sight: 80 },
    TargetSeek: {},
    Animation: { phase: 1.0 },
    Predator: {},
    Stressable: { resilience: 0.3 },
    DeathFx: { spawned: false },
  });

  world.update(1);

  // Tadpole should still be alive
  assert(world.hasEntity(eid), 'Immature tadpole not transformed');

  // No new froglet should exist
  const froglets = world.query('Species', 'Jump');
  assertEqual(froglets.length, 0, 'No Froglet spawned from immature tadpole');
})();

// Test 4: Non-morphable species with growth >= 1 are ignored
(function testNonMorphableSpeciesIgnored() {
  const world = setupWorld();

  // Froglet with growth >= 1 should NOT morph (froglets don't morph in old code)
  const eid = world.createEntity({
    Position: { x: 200, y: 200, vx: 0, vy: 0 },
    Renderable: { radius: 16, color: '#88cc44', alpha: 1.0, layer: 1 },
    Species: { type: 'froglet' },
    Age: { age: 500, maxAge: 3000 },
    Growth: { growth: 1.0, maxSize: 24, growthRate: 0.002 },
    Energy: { energy: 100, maxEnergy: 100, satiation: 90, metabolism: 0.4 },
    Mouth: { gape: 9, diet: 'both', eatCooldown: 0 },
    Steering: { speed: 5, agility: 1.0, sight: 120 },
    TargetSeek: {},
    Jump: { cooldown: 0, jumpDrive: 1.0 },
    Animation: { phase: 1.0 },
    Predator: {},
    Stressable: { resilience: 0.3 },
    DeathFx: { spawned: false },
  });

  world.update(1);

  // Froglet should still be alive (froglets don't morph)
  assert(world.hasEntity(eid), 'Froglet with growth=1 not transformed (no morph target)');

  // No mosquito or unknown type spawned
  const mosquitoes = world.query('Species', 'Flight');
  assertEqual(mosquitoes.length, 0, 'No Mosquito spawned from mature froglet');
})();

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n=== MorphSystem Tests Complete ===\n');
