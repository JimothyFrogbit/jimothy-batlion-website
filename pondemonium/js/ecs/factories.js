// ── Entity Factories ─────────────────────────────────────────────────
// Single source of truth for "what components does species X have and
// how are its stats derived from its genome". Used by ReproductionSystem
// (ongoing spawns), HatchSystem (frogSpawn → tadpole), and Pond.seed()
// (initial population) so all three creation paths stay in sync —
// previously each duplicated the same component list independently,
// and they drifted (see HatchSystem/MorphSystem genome-expression fixes).

import {
  Position, Renderable, Species, Age, Growth, Energy, Mouth,
  Steering, TargetSeek, Animation, Stressable, DeathFx, Nutrition,
} from './components.js';
import { lerp } from '../utils.js';
import { expressGenome, sampleAlgaeGenePool } from '../genome.js';
import { TADPOLE_GROWTH_RATE } from './balance.js';

/** Create a food (algae) entity. genotype defaults to a fresh gene-pool sample. */
export function createFood(world, x, y, genotype = sampleAlgaeGenePool()) {
  const { POU1F1, IGF1, LEP, THR } = genotype;
  const radius = 2 + (POU1F1 * 0.4 + IGF1 * 0.4) * 6;
  const nutrition = radius * 1.5;
  const maxAge = 200 + (LEP * 0.5 + THR * 0.2) * 700;

  return world.createEntity({
    Position: Position(x, y),
    Renderable: Renderable(radius, null, 0),
    Species: Species('food'),
    Age: { age: 0, maxAge },
    Nutrition: Nutrition(nutrition),
    Genome: { genotype, phenotype: null },
  });
}

/** Create a tadpole entity from a given (already sampled/bred) genotype. */
export function createTadpole(world, x, y, genotype) {
  const p = expressGenome(genotype);
  return world.createEntity({
    Position: Position(x, y),
    Renderable: Renderable(4, null, 1),
    Species: Species('tadpole'),
    Age: Age(Infinity),
    Genome: { genotype, phenotype: null },
    Growth: Growth(0, lerp(6, 16, p.bodySize), lerp(...TADPOLE_GROWTH_RATE, p.growthSpeed)),
    Energy: Energy(100, 100, 100, lerp(0.3, 1.5, p.metabolism)),
    Mouth: Mouth(lerp(1, 5, p.mouthGape), 'algae'),
    Steering: Steering(lerp(0.3, 1.8, p.swimSpeed), lerp(1.0, 0.15, p.bodySize), lerp(30, 120, p.sightRange)),
    TargetSeek: TargetSeek(),
    Animation: Animation(),
    Stressable: Stressable(p.stressResilience),
    DeathFx: DeathFx(false),
  });
}
