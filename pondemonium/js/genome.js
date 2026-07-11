// ── Genome / DNA — Regulatory Gene Model ────────────────────────────
import { rand, clamp } from './utils.js';

// Instead of 8 independent trait sliders, we model REGULATORY GENES
// that affect multiple phenotypic traits simultaneously, creating
// natural trade-offs and correlated evolution (like real biology).

// Genotype (inherited + mutated):
//   POU1F1 — pituitary factor: growth hormone, metabolism, appetite
//   THR   — thyroid receptor: metamorphosis timing, metabolic rate
//    MC1R  — melanocortin: pigmentation, stress response, activity
//    IGF1  — insulin-like GF: body size, cell division rate
//    LEP   — leptin sensitivity: energy efficiency, satiety
//    NR3C1 — glucocorticoid receptor: stress hormone sensitivity, resilience

// Phenotype (expressed traits — COMPUTED from genotype via mapping):
//   growthSpeed, bodySize, metabolism, mouthGape, swimSpeed,
//   sightRange, tailRetention, hue, stressResilience

export const REGULATORY_GENES = ['POU1F1', 'THR', 'MC1R', 'IGF1', 'LEP', 'NR3C1'];
export const PHENOTYPE_KEYS = [
  'growthSpeed', 'bodySize', 'metabolism', 'mouthGape',
  'swimSpeed', 'sightRange', 'tailRetention', 'hue', 'stressResilience',
];

export function randomGenotype() {
  const g = {};
  REGULATORY_GENES.forEach((k) => { g[k] = rand(0.15, 0.85); });
  return g;
}

// Compute expressed phenotype from regulatory genotype.
export function genotypeToPhenotype(g) {
  const { POU1F1, THR, MC1R, IGF1, LEP, NR3C1 } = g;
  const growthSpeed = clamp(POU1F1 * 0.6 + THR * 0.3);
  const bodySize = clamp(IGF1 * 0.7 + POU1F1 * 0.2 - THR * 0.15 + 0.15);
  const metabolism = clamp(POU1F1 * 0.4 + THR * 0.4 - LEP * 0.2 + 0.2);
  const mouthGape = clamp(bodySize * 0.7 + 0.15);
  const swimSpeed = clamp(THR * 0.5 + MC1R * 0.2 - bodySize * 0.3 + 0.3);
  const sightRange = clamp(MC1R * 0.4 + POU1F1 * 0.1 + 0.3);
  const tailRetention = clamp((1 - THR) * 0.7 + LEP * 0.1);
  const hue = clamp(MC1R * 0.6 + POU1F1 * 0.2);
  const stressResilience = clamp(NR3C1 * 0.5 + MC1R * 0.2 + LEP * 0.15 - metabolism * 0.1 + 0.25);
  return { growthSpeed, bodySize, metabolism, mouthGape, swimSpeed, sightRange, tailRetention, hue, stressResilience };
}

// Cached call: returns phenotype with lazy eval
export function expressGenome(genotype) {
  if (!genotype._phenotype) {
    genotype._phenotype = genotypeToPhenotype(genotype);
  }
  return genotype._phenotype;
}

// Breed two genotypes with crossover + mutation (on REGULATORY GENES only)
export function breedGenotype(g1, g2, mutationRate = 0.12, mutationMag = 0.15) {
  const child = {};
  REGULATORY_GENES.forEach((k) => {
    child[k] = Math.random() < 0.5 ? g1[k] : g2[k];
    if (Math.random() < mutationRate) {
      child[k] = clamp(child[k] + rand(-mutationMag, mutationMag));
    }
  });
  // Propagate parent tracking
  if (g1._parentIds && g1._parentIds.length > 0) child._parentIds = [...g1._parentIds];
  else if (g2._parentIds && g2._parentIds.length > 0) child._parentIds = [...g2._parentIds];
  child._phenotype = null;
  return child;
}

// Pool of successful genotypes (frogs that left the pond)
export let genePool = [];
let _nextId = 1;

export function addToGenePool(genotype) {
  genePool.push({ ...genotype, _phenotype: null, _id: _nextId++, _offspring: 0, _parentIds: genotype._parentIds || [] });
  if (genePool.length > 200) genePool.splice(0, genePool.length - 200);
}

export function sampleGenePool() {
  if (genePool.length === 0) { const g = randomGenotype(); g._parentIds = []; return g; }
  if (genePool.length === 1) { const g = genePool[0]; g._offspring = (g._offspring || 0) + 1; const c = {...g, _phenotype: null}; c._parentIds = [g._id]; return c; }
  const pick = () => {
    let best = rndChoice(genePool);
    for (let i = 0; i < 2; i++) {
      const challenger = rndChoice(genePool);
      if (fitnessScore(expressGenome(best)) < fitnessScore(expressGenome(challenger))) best = challenger;
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

export function getHallOfFame(n = 5) {
  const withOffspring = genePool.filter(g => (g._offspring || 0) > 0);
  const sorted = withOffspring.sort((a, b) => (b._offspring || 0) - (a._offspring || 0));
  return sorted.slice(0, n);
}

// ── Species-specific gene pools ──────────────────────────────────
// Mosquitoes: survive to leave = genes enter pool
export let mosquitoGenePool = [];
export function addToMosquitoGenePool(g) { mosquitoGenePool.push({...g, _phenotype: null}); if (mosquitoGenePool.length > 200) mosquitoGenePool.length = 200; }
export function sampleMosquitoGenePool() {
  if (mosquitoGenePool.length === 0) return randomGenotype();
  if (mosquitoGenePool.length === 1) return {...mosquitoGenePool[0], _phenotype: null};
  const pick = () => {
    let best = rndChoice(mosquitoGenePool);
    for (let i = 0; i < 2; i++) {
      const challenger = rndChoice(mosquitoGenePool);
      if (fitnessScore(expressGenome(best)) < fitnessScore(expressGenome(challenger))) best = challenger;
    }
    return best;
  };
  const a = pick(), b = pick();
  return breedGenotype(a, b);
}

// Dragonflies: emerge from pond = genes enter pool
export let dragonflyGenePool = [];
export function addToDragonflyGenePool(g) { dragonflyGenePool.push({...g, _phenotype: null}); if (dragonflyGenePool.length > 200) dragonflyGenePool.length = 200; }
export function sampleDragonflyGenePool() {
  if (dragonflyGenePool.length === 0) return randomGenotype();
  if (dragonflyGenePool.length === 1) return {...dragonflyGenePool[0], _phenotype: null};
  const pick = () => {
    let best = rndChoice(dragonflyGenePool);
    for (let i = 0; i < 2; i++) {
      const challenger = rndChoice(dragonflyGenePool);
      if (fitnessScore(expressGenome(best)) < fitnessScore(expressGenome(challenger))) best = challenger;
    }
    return best;
  };
  const a = pick(), b = pick();
  return breedGenotype(a, b);
}

function rndChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Algae gene pool ───────────────────────────────────────────────
export let algaeGenePool = [];
export function addToAlgaeGenePool(g) { algaeGenePool.push({...g, _phenotype: null}); if (algaeGenePool.length > 200) algaeGenePool.length = 200; }
export function sampleAlgaeGenePool() {
  if (algaeGenePool.length === 0) return randomGenotype();
  if (algaeGenePool.length === 1) return {...algaeGenePool[0], _phenotype: null};
  const pick = () => {
    let best = rndChoice(algaeGenePool);
    for (let i = 0; i < 2; i++) {
      const challenger = rndChoice(algaeGenePool);
      if (fitnessScore(expressGenome(best)) < fitnessScore(expressGenome(challenger))) best = challenger;
    }
    return best;
  };
  const a = pick(), b = pick();
  return breedGenotype(a, b);
}

// Fitness score based on PHENOTYPE (used for tournament selection in gene pool)
export function fitnessScore(p) {
  return (p.growthSpeed * 25 + (1 - p.metabolism) * 10 + p.swimSpeed * 15 + p.sightRange * 15 + p.mouthGape * 10 + p.stressResilience * 25) / 100;
}