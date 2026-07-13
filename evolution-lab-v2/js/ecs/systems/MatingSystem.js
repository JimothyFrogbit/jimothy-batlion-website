// ── Mating System ──────────────────────────────────────────────────
// Sexual reproduction — critters find mates, breed, and produce
// offspring with recombinant genomes.
//
// When a critter has enough energy and no cooldown, it looks for a
// compatible mate within detection range. If both agree to mate:
//   1. Each parent pays an energy cost
//   2. Offspring genome is bred via crossover + mutation
//   3. Offspring spawns between the parents
//
// Phase 2 foundation for emergent speciation — offspring inherit a
// blended genome, so trait lineages diverge over generations.

import { EcsSystem } from '../engine.js';
import { dist } from '../../utils.js';
import { breedGenotype, expressGenome, addToGenePool } from '../../genome.js';
import { hslToHex } from '../factories.js';

export class MatingSystem extends EcsSystem {
  constructor() {
    super('Mating');
  }

  update(dt, world) {
    const [posStore, energyStore, mtStore, ccStore, genomeStore, speciesStore] =
      world.getStores('Position', 'Energy', 'Mating', 'CritterConfig', 'Genome', 'SpeciesLabel');

    if (!posStore || !energyStore || !mtStore || !ccStore || !genomeStore) return;

    // Decrement cooldowns
    for (const [, mt] of mtStore.getAll()) {
      if (mt.cooldown > 0) mt.cooldown--;
    }

    // Collect candidate breeders
    const candidates = [];
    for (const [eid, mt] of mtStore.getAll()) {
      if (mt.cooldown > 0) continue;
      if (!world.hasEntity(eid)) continue;
      const energy = energyStore.get(eid);
      if (!energy || energy.energy < energy.maxEnergy * 0.55) continue;
      const pos = posStore.get(eid);
      if (!pos) continue;
      const cc = ccStore.get(eid);
      if (!cc) continue;
      candidates.push({ eid, pos, energy, cc, mt });
    }

    if (candidates.length < 2) return;

    // Shuffle for fairness — prevents first-in-list pairing bias
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Mate pairing — greedy nearest-neighbour within detection range
    const mated = new Set();

    for (let i = 0; i < candidates.length; i++) {
      if (mated.has(candidates[i].eid)) continue;

      let bestMate = null;
      let bestDist = Infinity;

      for (let j = i + 1; j < candidates.length; j++) {
        if (mated.has(candidates[j].eid)) continue;
        const d = dist(candidates[i].pos, candidates[j].pos);
        // Mating range: smaller of the two detection ranges
        const rangeI = candidates[i].cc.detectionRange * 30 + 30;
        const rangeJ = candidates[j].cc.detectionRange * 30 + 30;
        const maxRange = Math.min(rangeI, rangeJ);
        if (d < maxRange && d < bestDist) {
          bestDist = d;
          bestMate = j;
        }
      }

      if (bestMate !== null) {
        const p1 = candidates[i];
        const p2 = candidates[bestMate];
        this._breed(world, p1, p2);
        mated.add(p1.eid);
        mated.add(p2.eid);
      }
    }
  }

  _breed(world, p1, p2) {
    const stores = world.getStores('Genome');
    if (!stores || !Array.isArray(stores)) return;
    const [genomeStore] = stores;

    const g1 = genomeStore.get(p1.eid);
    const g2 = genomeStore.get(p2.eid);
    if (!g1 || !g2) return;

    // Energy cost: 8% of max to each parent
    const cost = p1.energy.maxEnergy * 0.08;
    p1.energy.energy = Math.max(10, p1.energy.energy - cost);
    p2.energy.energy = Math.max(10, p2.energy.energy - cost);

    // Cooldown after mating
    p1.mt.cooldown = 40 + Math.floor(Math.random() * 20);
    p2.mt.cooldown = 40 + Math.floor(Math.random() * 20);
    p1.mt.offspringCount++;
    p2.mt.offspringCount++;

    // Breed genome — crossover + mutation
    const childGeno = breedGenotype(g1.genotype, g2.genotype);
    const childPheno = expressGenome(childGeno);
    addToGenePool(childGeno);

    // Spawn position: midpoint between parents with jitter
    const cx = (p1.pos.x + p2.pos.x) / 2 + (Math.random() - 0.5) * 12;
    const cy = (p1.pos.y + p2.pos.y) / 2 + (Math.random() - 0.5) * 12;

    // Clamp to world bounds (approximate 800x600)
    const clampedX = Math.max(5, Math.min(795, cx));
    const clampedY = Math.max(5, Math.min(595, cy));

    // Create offspring entity
    world.createEntity({
      Position: { x: clampedX, y: clampedY, vx: 0, vy: 0 },
      Renderable: {
        radius: 3 + childPheno.bodySize * 8,
        color: hslToHex(childPheno.hue * 0.35 + 0.15, 0.6, 0.45 + childPheno.aggression * 0.1),
        alpha: 1.0,
      },
      Genome: { genotype: childGeno, phenotype: childPheno },
      SpeciesLabel: { groupId: -1, name: 'Juvenile' },
      Energy: {
        energy: 40,
        maxEnergy: 100,
        metabolism: childPheno.metabolism * 1.5 + 0.5,
      },
      Age: { age: 0, maxAge: 400 + childPheno.stressResilience * 400 },
      Senses: {
        sight: childPheno.detectionRange * 60 + 30,
        smell: childPheno.detectionRange * 20 + 20,
      },
      Mouth: { gape: childPheno.mouthGape * 10 + 3 },
      CritterConfig: {
        speed: childPheno.speed,
        aggression: childPheno.aggression,
        mouthGape: childPheno.mouthGape,
        detectionRange: childPheno.detectionRange,
        bodySize: childPheno.bodySize,
        hue: childPheno.hue,
        stressResilience: childPheno.stressResilience,
      },
      Mating: { cooldown: 60, readiness: 0, offspringCount: 0 },
    });
  }
}
