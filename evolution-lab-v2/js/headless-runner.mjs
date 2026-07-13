// ── Headless Runner for Evolution Lab v2 ────────────────────────
// Runs the simulation at maximum speed with no rendering overhead.
// Records data at regular intervals for analysis.
//
// Usage: node /workspace/public/evolution-lab-v2/js/headless-runner.mjs
//
// Each generation is 500 ticks (matching the main.js convention).

import { EcsWorld } from './ecs/engine.js';
import { registerAllComponents } from './ecs/components.js';
import { registerAllSystems } from './ecs/systems.js';
import { spawnCritter, spawnFood } from './ecs/factories.js';
import { resetPool, addToGenePool, sampleGenePool, getHallOfFame } from './genome.js';
import { clusterSpecies, countSpecies, resetClustering } from './species.js';
import { dist } from './utils.js';

const W = 800, H = 600;
const GENERATION_LENGTH = 500;  // ticks per generation
const MAX_GENERATIONS = 100;    // how many generations to simulate
const RECORD_INTERVAL = 10;     // record every N generations
const RUNS = 2;                 // number of replicate runs

function createWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world);
  return world;
}

function populateWorld(world, critterCount = 30, foodCount = 40) {
  for (let i = 0; i < critterCount; i++) {
    spawnCritter(world, Math.random() * W, Math.random() * H);
  }
  for (let i = 0; i < foodCount; i++) {
    spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
  }
}

function getSpeciesInfo(world) {
  const speciesStore = world.getStore('SpeciesLabel');
  const genomeStore = world.getStore('Genome');
  const groups = {};
  
  if (!speciesStore || !genomeStore) return { count: 0, diversity: 0, groups: {} };
  
  for (const [eid, data] of speciesStore.getAll()) {
    if (!world.hasEntity(eid)) continue;
    const gid = data.groupId;
    if (!groups[gid]) groups[gid] = [];
    const genome = genomeStore.get(eid);
    if (genome) groups[gid].push(genome.genotype);
  }
  
  // Calculate mean pairwise genetic distance within each species
  let totalDiv = 0;
  let groupCount = 0;
  for (const [gid, members] of Object.entries(groups)) {
    if (members.length < 2) continue;
    let divSum = 0;
    let pairs = 0;
    for (let i = 0; i < Math.min(members.length, 10); i++) {
      for (let j = i + 1; j < Math.min(members.length, 10); j++) {
        const keys = Object.keys(members[i]).filter(k => !k.startsWith('_'));
        let d = 0;
        for (const k of keys) {
          d += Math.abs(members[i][k] - members[j][k]);
        }
        divSum += d / keys.length;
        pairs++;
      }
    }
    totalDiv += pairs > 0 ? divSum / pairs : 0;
    groupCount++;
  }
  
  return {
    count: Object.keys(groups).length,
    diversity: groupCount > 0 ? totalDiv / groupCount : 0,
    groupSizes: Object.values(groups).map(g => g.length).sort((a,b) => b-a),
  };
}

function getTraitStats(world) {
  const genomeStore = world.getStore('Genome');
  const allTraits = { speed: [], bodySize: [], metabolism: [], aggression: [], mouthGape: [], detectionRange: [], stressResilience: [], hue: [] };
  let count = 0;
  
  if (!genomeStore) return allTraits;
  
  for (const [eid, data] of genomeStore.getAll()) {
    if (!world.hasEntity(eid)) continue;
    const p = data.phenotype;
    if (!p) continue;
    for (const k of Object.keys(allTraits)) {
      if (p[k] !== undefined) allTraits[k].push(p[k]);
    }
    count++;
  }
  
  const stats = {};
  for (const [k, vals] of Object.entries(allTraits)) {
    if (vals.length === 0) { stats[k] = { mean: 0, min: 0, max: 0, std: 0 }; continue; }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    stats[k] = { mean: +mean.toFixed(4), min: +min.toFixed(4), max: +max.toFixed(4), std: +Math.sqrt(variance).toFixed(4) };
  }
  stats._count = count;
  return stats;
}

function runSimulation(seed) {
  Math.seedrandom && Math.seedrandom(seed);
  const world = createWorld();
  populateWorld(world);
  
  let tickCount = 0;
  let generation = 0;
  let records = [];
  let extinctions = 0;
  let peakSpecies = 0;
  let peakPop = 0;
  
  while (generation < MAX_GENERATIONS) {
    world.update(1/60);
    world.reapDead();
    
    tickCount++;
    
    // Track generations
    if (tickCount % GENERATION_LENGTH === 0) {
      generation++;
      
      // Species clustering
      clusterSpecies(world, tickCount);
      
      const pop = world.activeEntityCount;
      const speciesInfo = getSpeciesInfo(world);
      const traits = getTraitStats(world);
      
      if (pop > peakPop) peakPop = pop;
      if (speciesInfo.count > peakSpecies) peakSpecies = speciesInfo.count;
      
      // Extinction detection
      if (speciesInfo.count === 0 && pop > 0) {
        extinctions++;
      }
      
      // Record at intervals
      if (generation % RECORD_INTERVAL === 0) {
        records.push({
          gen: generation,
          pop,
          species: speciesInfo.count,
          diversity: +speciesInfo.diversity.toFixed(4),
          groupSizes: speciesInfo.groupSizes.slice(0, 5).join(','),
          hallOfFame: getHallOfFame(3).map(g => ({
            id: g._id,
            fitness: g._offspring || 0,
            traits: Object.fromEntries(
              Object.entries(g).filter(([k]) => !k.startsWith('_'))
                .map(([k,v]) => [k, +v.toFixed(3)])
            ),
          })),
          traits: Object.fromEntries(
            Object.entries(traits)
              .filter(([k]) => !k.startsWith('_'))
              .map(([k,v]) => [k, v.mean])
          ),
        });
      }
      
      // Auto-rescue if population crashes
      if (pop < 5) {
        for (let i = 0; i < 10; i++) {
          spawnCritter(world, Math.random() * W, Math.random() * H);
        }
        if (world.count('FoodSource') < 20) {
          for (let i = 0; i < 20; i++) {
            spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
          }
        }
      }
    }
    
    // Periodic food respawn
    if (tickCount % 120 === 0 && world.count('FoodSource') < 60) {
      spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
    }
  }
  
  return { records, extinctions, peakSpecies, peakPop, finalGen: generation, finalPop: world.activeEntityCount };
}

// ── Run ─────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('🧬 EVOLUTION LAB v2 — Headless 1000-Generation Experiment');
console.log(`  ${RUNS} replicate run(s), ${MAX_GENERATIONS} generations each`);
console.log(`  Recording every ${RECORD_INTERVAL} generations`);
console.log('='.repeat(72));

for (let run = 1; run <= RUNS; run++) {
  const seed = 42 + run;
  console.log(`\n─── Run ${run}/${RUNS} (seed ${seed}) ──────────────────────────────`);
  
  const t0 = performance.now();
  const result = runSimulation(seed);
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  
  console.log(`  Completed: ${result.finalGen} generations in ${elapsed}s`);
  console.log(`  Final population: ${result.finalPop}`);
  console.log(`  Peak species: ${result.peakSpecies}`);
  console.log(`  Peak population: ${result.peakPop}`);
  console.log(`  Extinctions: ${result.extinctions}`);
  
  // Print summary trajectory
  console.log(`\n  ── Trajectory (every ${RECORD_INTERVAL} gens) ──`);
  console.log(`  ${'Gen'.padStart(5)} ${'Pop'.padStart(5)} ${'Sp'.padStart(3)} ${'Diversity'.padStart(9)} ${'Group'.padStart(18)} ${'Top traits'.padStart(40)}`);
  console.log(`  ${'-'.repeat(5)} ${'-'.repeat(5)} ${'-'.repeat(3)} ${'-'.repeat(9)} ${'-'.repeat(18)} ${'-'.repeat(40)}`);
  
  for (const r of result.records) {
    const topTrait = r.hallOfFame && r.hallOfFame[0] 
      ? Object.entries(r.traits).map(([k,v]) => `${k}:${v}`).join(' ')
      : '-';
    console.log(`  ${String(r.gen).padStart(5)} ${String(r.pop).padStart(5)} ${String(r.species).padStart(3)} ${String(r.diversity).padStart(9)} ${String(r.groupSizes || '-').padStart(18)} ${topTrait.slice(0, 40).padStart(40)}`);
  }
  
  // Final state snapshot
  console.log(`\n  ── Final generation snapshot ──`);
  if (result.records.length > 0) {
    const last = result.records[result.records.length - 1];
    console.log(`  Population: ${last.pop}, Species: ${last.species}, Diversity: ${last.diversity}`);
    console.log(`  Mean traits: ${JSON.stringify(last.traits)}`);
    if (last.hallOfFame && last.hallOfFame.length > 0) {
      console.log(`  Hall of Fame (top reproducer):`);
      for (const h of last.hallOfFame) {
        console.log(`    #${h.id}: ${h.fitness} offspring, traits=${JSON.stringify(h.traits)}`);
      }
    }
  }
}

console.log(`\n${'='.repeat(72)}`);
console.log('Experiment complete.');
