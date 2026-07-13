// ── Critter Factory ────────────────────────────────────────────────
// Spawns critter entities with random genomes.
// The genome's expressed phenotype determines the critter's behaviour
// — no hardcoded species, no isPredator flag.

import { randomGenotype, expressGenome } from '../genome.js';
import { registerAllComponents } from './components.js';

export function spawnCritter(world, x, y) {
  const genotype = randomGenotype();
  const phenotype = expressGenome(genotype);

  const eid = world.createEntity({
    Position: { x, y, vx: 0, vy: 0 },
    Renderable: {
      radius: 3 + phenotype.bodySize * 8,
      color: hslToHex(phenotype.hue * 0.35 + 0.15, 0.6, 0.45 + phenotype.aggression * 0.1),
      alpha: 1.0,
    },
    Genome: { genotype, phenotype },
    SpeciesLabel: { groupId: 0, name: 'Critter' },
    Energy: {
      energy: 80,
      maxEnergy: 100,
      metabolism: phenotype.metabolism * 1.5 + 0.5,
    },
    Age: { age: 0, maxAge: 400 + phenotype.stressResilience * 400 },
    Senses: {
      sight: phenotype.detectionRange * 60 + 30,
      smell: phenotype.detectionRange * 20 + 20,
    },
    Mouth: { gape: phenotype.mouthGape * 10 + 3 },
    Mating: { cooldown: Math.floor(Math.random() * 30), readiness: 0, offspringCount: 0 },
    CritterConfig: {
      speed: phenotype.speed,
      aggression: phenotype.aggression,
      mouthGape: phenotype.mouthGape,
      detectionRange: phenotype.detectionRange,
      bodySize: phenotype.bodySize,
      hue: phenotype.hue,
      stressResilience: phenotype.stressResilience,
    },
  });

  return eid;
}

/** Spawn a food source at (x, y). */
export function spawnFood(world, x, y, nutrition = 8) {
  const eid = world.createEntity({
    Position: { x, y, vx: 0, vy: 0 },
    Renderable: {
      radius: 4 + nutrition * 0.5,
      color: '#44bb44',
      alpha: 0.8,
    },
    FoodSource: { nutrition, radius: 8 },
  });
  return eid;
}

// ── Colour helper ─────────────────────────────────────────────────

export function hslToHex(h, s, l) {
  h = Math.max(0, Math.min(1, h));
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 1 / 6) { r = c; g = x; b = 0; }
  else if (h < 2 / 6) { r = x; g = c; b = 0; }
  else if (h < 3 / 6) { r = 0; g = c; b = x; }
  else if (h < 4 / 6) { r = 0; g = x; b = c; }
  else if (h < 5 / 6) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const hex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
