// ── Optimised Headless Runner for Evolution Lab v2 ──────────────
// Adds population cap + lower mating frequency to keep the
// simulation running at usable speed for long-term experiments.

import { EcsWorld } from './ecs/engine.js';
import { registerAllComponents } from './ecs/components.js';
import { registerAllSystems } from './ecs/systems.js';
import { spawnCritter, spawnFood } from './ecs/factories.js';
import { resetPool, addToGenePool, sampleGenePool, getHallOfFame } from './genome.js';
import { clusterSpecies, countSpecies, resetClustering } from './species.js';
import { MatingSystem } from './ecs/systems/MatingSystem.js';

const W = 800, H = 600;
const GENERATION_LENGTH = 500;  // ticks per generation
const MAX_GENERATIONS = 300;    // generations
const RECORD_INTERVAL = 30;     // record every N generations
const POP_CAP = 120;            // max critters before reproduction pauses
const MATE_EVERY_N_TICKS = 50;  // MatingSystem runs every N ticks
const FOOD_RESPAWN_INTERVAL = 150;
const RUNS = 1;

function createWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world);
  return world;
}

function populateWorld(world, critterCount = 25, foodCount = 50) {
  for (let i = 0; i < critterCount; i++) {
    spawnCritter(world, Math.random() * W, Math.random() * H);
  }
  for (let i = 0; i < foodCount; i++) {
    spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
  }
}

function getSpeciesData(world) {
  const speciesStore = world.getStore('SpeciesLabel');
  const genomeStore = world.getStore('Genome');
  if (!speciesStore || !genomeStore) return { count: 0, groups: [] };
  
  const groups = {};
  for (const [eid, data] of speciesStore.getAll()) {
    if (!world.hasEntity(eid)) continue;
    const gid = data.groupId;
    if (!groups[gid]) groups[gid] = 0;
    groups[gid]++;
  }
  
  const sizes = Object.values(groups).sort((a,b) => b-a);
  return { count: sizes.length, groups: sizes };
}

function getTraitAverages(world) {
  const genomeStore = world.getStore('Genome');
  if (!genomeStore) return {};
  const sums = {};
  let count = 0;
  for (const [eid, data] of genomeStore.getAll()) {
    if (!world.hasEntity(eid) || !data.phenotype) continue;
    for (const [k, v] of Object.entries(data.phenotype)) {
      sums[k] = (sums[k] || 0) + v;
    }
    count++;
  }
  if (count === 0) return { _count: 0 };
  const avg = { _count: count };
  for (const [k, v] of Object.entries(sums)) {
    avg[k] = +(v / count).toFixed(4);
  }
  return avg;
}

function runSimulation(seed) {
  const world = createWorld();
  populateWorld(world);
  const matingSystem = world.getSystem('Mating');
  if (matingSystem) matingSystem.enabled = false; // disable the built-in one
  
  // Create a separate throttled mating system
  const throttledMating = new MatingSystem();
  
  let tickCount = 0;
  let generation = 0;
  const records = [];
  let peakSpecies = 0;
  let peakPop = 0;
  let totalExtinctions = 0;
  
  while (generation < MAX_GENERATIONS) {
    world.update(1/60);
    
    // Throttled mating (enabled/disabled per tick)
    if (tickCount % MATE_EVERY_N_TICKS === 0 && world.activeEntityCount < POP_CAP) {
      throttledMating.update(1/60, world);
    }
    
    world.reapDead();
    tickCount++;
    
    // Track generations
    if (tickCount % GENERATION_LENGTH === 0) {
      generation++;
      
      // Run species clustering
      clusterSpecies(world, tickCount);
      
      const pop = world.activeEntityCount;
      
      // Resupply if population crashes
      if (pop < 8) {
        for (let i = 0; i < 8; i++) {
          spawnCritter(world, Math.random() * W, Math.random() * H);
        }
      }
      
      // Track peaks
      if (pop > peakPop) peakPop = pop;
      const spData = getSpeciesData(world);
      if (spData.count > peakSpecies) peakSpecies = spData.count;
      if (spData.count === 0 && pop > 0) totalExtinctions++;
      
      // Record
      if (generation % RECORD_INTERVAL === 0 || generation === MAX_GENERATIONS) {
        const traits = getTraitAverages(world);
        records.push({
          gen: generation,
          pop,
          species: spData.count,
          groups: spData.groups.slice(0, 5).join(','),
          hall: getHallOfFame(2).map(g => ({
            id: g._id, off: g._offspring || 0,
            g: Object.fromEntries(Object.entries(g).filter(([k,v]) => !k.startsWith('_') && typeof v === 'number').map(([k,v]) => [k, +v.toFixed(3)])),
          })),
          traits: Object.fromEntries(
            Object.entries(traits).filter(([k]) => k !== '_count').map(([k,v]) => [k, +v.toFixed(3)])
          ),
          n: traits._count || 0,
        });
      }
    }
    
    // Food respawn
    if (tickCount % FOOD_RESPAWN_INTERVAL === 0 && world.count('FoodSource') < 60) {
      spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
    }
  }
  
  return {
    records,
    peakSpecies,
    peakPop,
    extinctions: totalExtinctions,
    finalGen: generation,
    finalPop: world.activeEntityCount,
    finalSp: getSpeciesData(world).count,
  };
}

// ── Main ───────────────────────────────────────────────────────

console.log('='.repeat(80));
console.log('🧬 EVOLUTION LAB v2 — Long-Term Evolution Experiment');
console.log(`  ${RUNS} run(s), ${MAX_GENERATIONS} gens each, record every ${RECORD_INTERVAL}`);
console.log(`  Pop cap: ${POP_CAP}, Mate every ${MATE_EVERY_N_TICKS} ticks`);
console.log('='.repeat(80));

for (let run = 1; run <= RUNS; run++) {
  console.log(`\n─── Run ${run}/${RUNS} ────────────────────────────────────────────`);
  const t0 = performance.now();
  const r = runSimulation(42 + run);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  
  console.log(`  ${r.finalGen} gens in ${secs}s | Final: pop=${r.finalPop} sp=${r.finalSp}`);
  console.log(`  Peak: pop=${r.peakPop} sp=${r.peakSpecies} | Crashes recovered: ${r.extinctions}`);
  
  console.log(`\n  ${'Gen'.padStart(5)} ${'Pop'.padStart(5)} ${'Sp'.padStart(3)} ${'Sizes'.padStart(18)} ${'Top traits'.padStart(40)}`);
  console.log(`  ${'-'.repeat(5)} ${'-'.repeat(5)} ${'-'.repeat(3)} ${'-'.repeat(18)} ${'-'.repeat(40)}`);
  
  for (const rec of r.records) {
    const traitStr = rec.traits ? Object.entries(rec.traits).map(([k,v]) => `${k.substring(0,4)}:${v}`).join(' ') : '-';
    console.log(`  ${String(rec.gen).padStart(5)} ${String(rec.pop).padStart(5)} ${String(rec.species).padStart(3)} ${String(rec.groups || '-').padStart(18)} ${traitStr.substring(0, 40).padStart(40)}`);
  }
  
  if (r.records.length > 0) {
    const last = r.records[r.records.length - 1];
    console.log(`\n  ── Last generation traits (n=${last.n}) ──`);
    if (last.traits) {
      for (const [k, v] of Object.entries(last.traits)) {
        console.log(`    ${k}: ${v}`);
      }
    }
    if (last.hall && last.hall.length > 0) {
      console.log(`  Hall of Fame:`);
      for (const h of last.hall) {
        console.log(`    ID#${h.id}: ${h.off} offspring, genes=${JSON.stringify(h.g)}`);
      }
    }
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log('Done.');
