// ── Genome / DNA — Regulatory Gene Model ────────────────────────────
// Evolution Lab v2 — simplified for the emergence testbed.
//
// Genotype (inherited + mutated):
//   POU1F1 — pituitary factor: growth, metabolism, appetite
//   THR   — thyroid receptor: metabolic rate, activity level
//   MC1R  — melanocortin: pigmentation, stress response, aggression
//   IGF1  — insulin-like GF: body size, cell division rate
//   LEP   — leptin sensitivity: energy efficiency, satiety
//   NR3C1 — glucocorticoid receptor: stress hormone sensitivity, resilience
//
// Phenotype (expressed traits — COMPUTED from genotype):
//   speed, bodySize, metabolism, mouthGape, detectionRange,
//   aggression, hue, stressResilience

import { rand, clamp } from './utils.js';

export const REGULATORY_GENES = ['POU1F1', 'THR', 'MC1R', 'IGF1', 'LEP', 'NR3C1'];
export const PHENOTYPE_KEYS = [
  'speed', 'bodySize', 'metabolism', 'mouthGape',
  'detectionRange', 'aggression', 'hue', 'stressResilience',
];

/** Create a random genotype. */
export function randomGenotype() {
  const g = {};
  REGULATORY_GENES.forEach((k) => { g[k] = rand(0.15, 0.85); });
  return g;
}

/** Compute expressed phenotype from regulatory genotype. */
export function genotypeToPhenotype(g) {
  const { POU1F1, THR, MC1R, IGF1, LEP, NR3C1 } = g;

  const bodySize = clamp(IGF1 * 0.7 + POU1F1 * 0.2 - THR * 0.1 + 0.15);
  const speed = clamp(THR * 0.5 + MC1R * 0.2 - bodySize * 0.25 + 0.3);
  const metabolism = clamp(POU1F1 * 0.4 + THR * 0.4 - LEP * 0.2 + 0.2);
  const mouthGape = clamp(bodySize * 0.6 + POU1F1 * 0.1 + 0.15);
  const detectionRange = clamp(MC1R * 0.4 + POU1F1 * 0.1 + 0.3);
  const aggression = clamp(MC1R * 0.5 + THR * 0.2 - LEP * 0.1 + 0.15);
  const hue = clamp(MC1R * 0.6 + POU1F1 * 0.2);
  const stressResilience = clamp(NR3C1 * 0.5 + MC1R * 0.2 + LEP * 0.15 - metabolism * 0.1 + 0.25);

  return {
    speed, bodySize, metabolism, mouthGape,
    detectionRange, aggression, hue, stressResilience,
  };
}

/** Cached call: returns phenotype with lazy eval. */
export function expressGenome(genotype) {
  if (!genotype._phenotype) {
    genotype._phenotype = genotypeToPhenotype(genotype);
  }
  return genotype._phenotype;
}

/** Breed two genotypes with crossover + mutation. */
export function breedGenotype(g1, g2, mutationRate = 0.12, mutationMag = 0.15) {
  const child = {};
  REGULATORY_GENES.forEach((k) => {
    child[k] = Math.random() < 0.5 ? g1[k] : g2[k];
    if (Math.random() < mutationRate) {
      child[k] = clamp(child[k] + rand(-mutationMag, mutationMag));
    }
  });
  if (g1._parentIds && g1._parentIds.length > 0) child._parentIds = [...g1._parentIds];
  else if (g2._parentIds && g2._parentIds.length > 0) child._parentIds = [...g2._parentIds];
  child._phenotype = null;
  return child;
}

// ── Gene Pool ─────────────────────────────────────────────────────
// Successful reproducers contribute to the pool for future generations.
let genePool = [];
let _nextId = 1;

export function addToGenePool(genotype) {
  genePool.push({
    ...genotype, _phenotype: null, _id: _nextId++,
    _offspring: 0, _parentIds: genotype._parentIds || [],
  });
  if (genePool.length > 200) genePool.splice(0, genePool.length - 200);
}

export function sampleGenePool() {
  if (genePool.length === 0) { const g = randomGenotype(); g._parentIds = []; return g; }
  if (genePool.length === 1) {
    const g = genePool[0];
    g._offspring = (g._offspring || 0) + 1;
    return { ...g, _phenotype: null, _parentIds: [g._id] };
  }
  const pick = () => {
    let best = rndChoice(genePool);
    for (let i = 0; i < 2; i++) {
      const challenger = rndChoice(genePool);
      if (fitnessScore(expressGenome(best)) < fitnessScore(expressGenome(challenger))) {
        best = challenger;
      }
    }
    best._offspring = (best._offspring || 0) + 1;
    return best;
  };
  const p1 = pick(), p2 = pick();
  const child = breedGenotype(p1, p2);
  child._parentIds = [p1._id, p2._id];
  return child;
}

export function resetPool() {
  genePool.length = 0;
  _nextId = 1;
}

/** Get the top N most successful reproducers. */
export function getHallOfFame(n = 5) {
  const withOffspring = genePool.filter(g => (g._offspring || 0) > 0);
  const sorted = withOffspring.sort((a, b) => (b._offspring || 0) - (a._offspring || 0));
  return sorted.slice(0, n);
}

function rndChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Fitness score based on PHENOTYPE (used for tournament selection). */
export function fitnessScore(p) {
  // Balanced fitness: bodySize trades off vs speed, metabolism vs efficiency
  return (
    p.speed * 15 +
    (1 - p.metabolism) * 15 +
    p.bodySize * 10 +
    p.detectionRange * 15 +
    p.mouthGape * 10 +
    p.stressResilience * 20 +
    p.aggression * 15
  ) / 100;
}
