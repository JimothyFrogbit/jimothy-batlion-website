// ── Species Clustering ─────────────────────────────────────────────
// Periodic trait-based clustering that assigns species labels to
// critters based on phenotypic similarity.
//
// Uses a greedy clustering algorithm:
//   1. For each critter, compute phenotype distance to existing
//      cluster centroids
//   2. If closest centroid is below a threshold, join that cluster
//   3. Otherwise, start a new species cluster
//
// This is a KEY part of Phase 2 emergent speciation — species are
// NOT hardcoded. They emerge from the trait distributions created
// by sexual reproduction + selection.

import { PHENOTYPE_KEYS } from './genome.js';

const SPECIES_THRESHOLD = 0.18; // max trait-distance to be same species
const REASSIGN_INTERVAL = 200;  // ticks between full re-clustering
const SPECIES_COLORS = [
  '#66ccff', '#ff6666', '#66ff99', '#ffcc44',
  '#cc66ff', '#ff88aa', '#44ddcc', '#ff9944',
  '#99ccff', '#ff9999', '#88ff88', '#dddd44',
  '#cc99ff', '#ffaacc', '#66dddd', '#ffbb66',
];

let _nextClusterId = 1;
let _lastReassign = 0;

/** Reset clustering state (on sim reset). */
export function resetClustering() {
  _nextClusterId = 1;
  _lastReassign = 0;
}

/**
 * Convert a phenotype object into a numeric vector for distance
 * computation. All values are already in [0, 1].
 */
function phenotypeVector(phenotype) {
  return PHENOTYPE_KEYS.map(k => phenotype[k] || 0);
}

/**
 * Euclidean distance between two phenotype vectors.
 */
function phenotypeDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum / a.length); // normalised by dim count
}

/**
 * Assign species labels to all critters based on trait clustering.
 * Called periodically from the game loop.
 */
export function clusterSpecies(world, tickCount) {
  // Only run every REASSIGN_INTERVAL ticks
  if (tickCount - _lastReassign < REASSIGN_INTERVAL) return;
  _lastReassign = tickCount;

  const [genomeStore, speciesStore] = world.getStores('Genome', 'SpeciesLabel');
  if (!genomeStore || !speciesStore) return;

  const phenotypes = [];

  // Collect all critters with genomes
  for (const [eid, genome] of genomeStore.getAll()) {
    if (!world.hasEntity(eid)) continue;
    if (!genome.phenotype) continue;
    phenotypes.push({
      eid,
      vec: phenotypeVector(genome.phenotype),
      phenotype: genome.phenotype,
    });
  }

  if (phenotypes.length === 0) return;

  // Greedy clustering
  const clusters = []; // each: { centroid: number[], members: [{eid, vec}] }

  for (const p of phenotypes) {
    let bestCluster = -1;
    let bestDist = SPECIES_THRESHOLD;

    for (let ci = 0; ci < clusters.length; ci++) {
      const d = phenotypeDist(p.vec, clusters[ci].centroid);
      if (d < bestDist) {
        bestDist = d;
        bestCluster = ci;
      }
    }

    if (bestCluster >= 0) {
      clusters[bestCluster].members.push(p);
      // Update centroid
      const members = clusters[bestCluster].members;
      const newCentroid = new Array(p.vec.length).fill(0);
      for (const m of members) {
        for (let i = 0; i < m.vec.length; i++) {
          newCentroid[i] += m.vec[i];
        }
      }
      for (let i = 0; i < newCentroid.length; i++) {
        newCentroid[i] /= members.length;
      }
      clusters[bestCluster].centroid = newCentroid;
    } else {
      // Start new cluster
      clusters.push({
        centroid: [...p.vec],
        members: [p],
      });
    }
  }

  // Sort clusters by size (largest first) so species 0 = most common
  clusters.sort((a, b) => b.members.length - a.members.length);

  // Assign groupIds and names
  for (let ci = 0; ci < clusters.length; ci++) {
    const groupId = ci + 1;
    const name = clusters[ci].members.length >= 3
      ? `Species ${groupId}`
      : `Variant ${groupId}`;
    const color = SPECIES_COLORS[ci % SPECIES_COLORS.length];

    for (const m of clusters[ci].members) {
      const sl = speciesStore.get(m.eid);
      if (sl) {
        sl.groupId = groupId;
        sl.name = name;
      }
      // Update renderable color
      const renStore = world.getStore('Renderable');
      if (renStore) {
        const ren = renStore.get(m.eid);
        if (ren) {
          ren.color = color;
        }
      }
    }
  }

  // Return clustering stats with color + name info
  return {
    speciesCount: clusters.filter(c => c.members.length >= 3).length,
    variantCount: clusters.filter(c => c.members.length < 3).length,
    clusterSizes: clusters.map(c => c.members.length),
    species: clusters.map((c, ci) => ({
      name: c.members.length >= 3 ? `Species ${ci + 1}` : `Variant ${ci + 1}`,
      color: SPECIES_COLORS[ci % SPECIES_COLORS.length],
      count: c.members.length,
      isSpecies: c.members.length >= 3,
    })),
  };
}

/** Get the number of distinct species from the world state. */
export function countSpecies(world) {
  const [speciesStore] = world.getStores('SpeciesLabel');
  if (!speciesStore) return 0;
  const groups = new Set();
  for (const [, sl] of speciesStore.getAll()) {
    if (sl.groupId > 0) groups.add(sl.groupId);
  }
  return groups.size;
}
