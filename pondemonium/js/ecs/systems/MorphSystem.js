// ── MorphSystem ─────────────────────────────────────────────────────
// ECS Phase 2b: Handles metamorphosis for growing entities.
//
// When a creature reaches full growth (growth.growth >= 1), it
// transforms into its adult form:
//   Tadpole       → Froglet   (same position, inherit genome)
//   MosquitoLarva → Mosquito  (same area, slight upward offset)
//   DragonflyNymph → DragonflyAdult  (same area, upward offset)
//
// This mirrors the old code in pond.js:
//   Tadpole.update():        growth >= 1 → spawn Froglet
//   MosquitoLarva.update():  growth >= 1 → spawn Mosquito
//
// Component Requirements:
//   Query: Growth + Species + Position + Renderable + Age
//   Spawned: Froglet or Mosquito component sets
//
// Phase 2: Creates ECS entities that mirror the old-code transformation.
// The old entity is marked dead so DeathSystem can clean it up.
// Phase 3: Will also drive the pondRef entity lifecycle directly.
//
// ── Morph Rules ──────────────────────────────────────────────────────
// | Source          | Target          | Position           | Particles     |
// |-----------------|-----------------|--------------------|---------------|
// | Tadpole         | Froglet         | Same x, y          | 6, green      |
// | MosquitoLarva   | Mosquito        | x±5, y-(5..15)     | 4, grey       |
// | DragonflyNymph  | DragonflyAdult  | x±5, y-(5..15)     | 6, teal       |
//
// ── Visual ───────────────────────────────────────────────────────────
// Morph particles use a distinct bright green (tadpole→froglet),
// grey (larva→mosquito), or teal (nymph→adult) to make
// transformations visible in the pond.

import { EcsSystem } from '../engine.js';
import {
  Position, Renderable, Species, Genome, Age, Growth,
  Energy, Mouth, Steering, TargetSeek, Jump, Animation,
  Flight, LifeLimited, Predator, ParticleState, Stressable,
  DeathFx,
} from '../components.js';
import { sampleMosquitoGenePool, expressGenome } from '../../genome.js';
import { lerp, clamp } from '../../utils.js';
import { FROGLET_GROWTH_RATE, DRAGONFLY_NYMPH_MIN_AGE } from '../balance.js';

/** Morph particle colours per species type. */
const MORPH_COLORS = {
  tadpole:        'hsla(140, 60%, 50%, 0.5)',   // bright green burst
  mosquitoLarva:  'hsla(0, 0%, 50%, 0.5)',       // grey puff
  dragonflyNymph: 'hsla(170, 60%, 45%, 0.6)',    // teal burst
  default:        'hsla(60, 80%, 60%, 0.4)',     // yellow sparkle
};

/** Default genome for newly morphed entities (shallow clone of parent). */
function cloneGenome(genomeComponent) {
  if (!genomeComponent) return null;
  return {
    ...genomeComponent,
    // Deep-clone nested objects
    genotype: genomeComponent.genotype ? { ...genomeComponent.genotype } : null,
    phenotype: genomeComponent.phenotype ? { ...genomeComponent.phenotype } : null,
  };
}

/**
 * Spawn morph particles at a position.
 * Returns nothing — particles are added directly to the ECS world.
 */
function spawnMorphParticles(world, x, y, speciesType, count = 6) {
  const color = MORPH_COLORS[speciesType] || MORPH_COLORS.default;
  for (let i = 0; i < count; i++) {
    const peid = world.createEntity({
      Position: Position(x, y),
      Renderable: Renderable(
        1 + Math.random() * 2,
        color,
        4  // top layer — particles float above everything
      ),
      Species: Species('particle'),
      ParticleState: ParticleState(
        15 + Math.random() * 15,  // life
        30,                        // maxLife
        1 + Math.random() * 1.5,   // size
        0.02,                      // gravity
        'dot',
        color
      ),
    });
    // Random outward velocity
    const ppos = world.getComponent(peid, 'Position');
    if (ppos) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 1.0;
      ppos.vx = Math.cos(angle) * speed;
      ppos.vy = Math.sin(angle) * speed;
    }
  }
}

export class MorphSystem extends EcsSystem {
  constructor() {
    super('MorphSystem');
    this._dragonfliesEmerged = 0;
  }

  /** Reset internal counters (called on pond reset). */
  reset() {
    this._dragonfliesEmerged = 0;
  }

  /** Get morph stats for pond consumption. */
  getMorphStats() {
    return { dragonfliesEmerged: this._dragonfliesEmerged };
  }

  update(dt, world) {
    const growthStore = world.getStore('Growth');
    const speciesStore = world.getStore('Species');
    const posStore = world.getStore('Position');
    const ageStore = world.getStore('Age');
    const renderStore = world.getStore('Renderable');
    const genomeStore = world.getStore('Genome');

    if (!growthStore || !speciesStore || !posStore || !ageStore || !renderStore) return;

    // Collect entities with growth >= 1 (snapshot to avoid modifying during iteration)
    const toMorph = [];
    for (const [eid, growth] of growthStore.getAll()) {
      if (growth.growth < 1) continue;

      const species = speciesStore.get(eid);
      if (!species) continue;

      const type = species.type;
      if (type !== 'tadpole' && type !== 'mosquitoLarva' && type !== 'dragonflyNymph') continue;

      const age = ageStore.get(eid);

      // Dragonfly nymphs: growth alone isn't a maturation signal here — it's
      // driven entirely by predation (+0.08/+0.04 per meal in FeedingSystem),
      // so a lucky early meal could otherwise let one emerge almost instantly.
      // Real naiads take a long time to develop regardless of feeding success;
      // this floor matches the legacy check (`growth>=1 && age>500`) that
      // silently stopped applying when Age.age wasn't ticking during the ECS
      // conversion (see AgeSystem/git history) — restored now that it does.
      if (type === 'dragonflyNymph' && (!age || age.age <= DRAGONFLY_NYMPH_MIN_AGE)) continue;

      const pos = posStore.get(eid);
      const renderable = renderStore.get(eid);
      const genome = genomeStore ? genomeStore.get(eid) : null;

      toMorph.push({ eid, type, pos, age, renderable, genome });
    }

    // ── Process each morph ──
    for (const { eid, type, pos, age, renderable, genome } of toMorph) {
      const x = pos.x;
      const y = pos.y;

      // Mark old entity as dead
      world.markDead(eid);

      // Spawn morph particles
      const particleCount = type === 'tadpole' || type === 'dragonflyNymph' ? 6 : 4;
      spawnMorphParticles(world, x, y, type, particleCount);

      // Create the morphed entity
      switch (type) {
        case 'tadpole': {
          this._morphToFroglet(world, x, y, genome);
          break;
        }
        case 'mosquitoLarva': {
          this._morphToMosquito(world, x, y);
          break;
        }
        case 'dragonflyNymph': {
          this._morphToDragonflyAdult(world, x, y, genome);
          this._dragonfliesEmerged++;
          break;
        }
      }
    }
  }

  // ── Tadpole → Froglet ────────────────────────────────────────────

  _morphToFroglet(world, x, y, genome) {
    // Traits are derived from the tadpole's expressed phenotype, matching
    // legacy Froglet constructor — without this, genome has no effect on
    // froglet behaviour at all.
    const p = genome?.genotype ? expressGenome(genome.genotype) : null;
    const maxSize = p ? lerp(12, 24, p.bodySize) : 16;
    const growthRate = p ? lerp(...FROGLET_GROWTH_RATE, p.growthSpeed) : FROGLET_GROWTH_RATE[0];
    const metabolism = p ? lerp(0.2, 1.2, p.metabolism) : 0.4;
    const mouthGape = p ? lerp(3, 10, p.mouthGape) : 9;
    const speed = p ? lerp(0.3, 1.8, p.swimSpeed) : 5;
    const agility = p ? lerp(1.0, 0.15, p.bodySize) : 1.0;
    const sight = p ? lerp(40, 160, p.sightRange) : 120;
    const jumpDrive = p ? lerp(0.3, 1.5, p.growthSpeed * 0.7 + p.bodySize * 0.3) : 1.0;
    const resilience = p ? p.stressResilience : 0.3;

    const newEid = world.createEntity({
      Position: Position(x, y),
      Renderable: Renderable(10, '#88cc44', 1),  // radius=10, froglet green
      Species: Species('froglet'),
      Age: { age: 0, maxAge: 3000 },
      Growth: Growth(0.85, maxSize, growthRate, null),
      Energy: { energy: 100, maxEnergy: 100, satiation: 80, metabolism },
      Mouth: Mouth(mouthGape, 'both'),
      Steering: Steering(speed, agility, sight),
      TargetSeek: TargetSeek(),
      Jump: Jump(jumpDrive),
      Animation: Animation(),
      Predator: {
        attackCooldown: 0,
        meals: 0,
        preferredPrey: ['food', 'mosquito'],
        huntCooldown: 0,
      },
      Stressable: { resilience },
      DeathFx: { spawned: false },
    });

    // Inherit genome from tadpole
    if (genome) {
      world.addComponent(newEid, 'Genome', cloneGenome(genome));
    }
  }

  // ── MosquitoLarva → Mosquito ────────────────────────────────────

  _morphToMosquito(world, x, y) {
    // Slight random offset — matching old code: x + rand(-5,5), y - rand(5,15)
    const offsetX = x + (Math.random() * 10 - 5);
    const offsetY = y - (5 + Math.random() * 10);

    // Mosquitoes always carry a genome, sampled from their gene pool
    // (matches legacy Mosquito constructor: `genome || sampleMosquitoGenePool()`).
    // Speed/lifespan/altitude are derived from it below — a mosquito with
    // hardcoded stats regardless of genome was the same class of bug as the
    // tadpole/froglet one (genome sampled but never actually used).
    const genotype = sampleMosquitoGenePool();
    const { POU1F1, THR, MC1R, IGF1, LEP } = genotype;
    const speed = lerp(0.3, 2.0, clamp(POU1F1 * 0.5 + THR * 0.3));
    const altitude = lerp(-30, -5, clamp(MC1R * 0.5 + THR * 0.3));
    const lifespan = lerp(100, 700, clamp(LEP * 0.6 + IGF1 * 0.2));
    const agility = lerp(1.0, 0.5, 3 / 8); // radius=3, matches legacy _agility formula

    const newEid = world.createEntity({
      Position: Position(offsetX, offsetY),
      Renderable: Renderable(3, '#aabbcc', 3),  // radius=3, flying layer
      Species: Species('mosquito'),
      Age: { age: 0, maxAge: lifespan + 200 },
      Steering: Steering(speed, agility, 40),  // sight unused — mosquitoes fly erratically, don't hunt
      Flight: Flight(altitude, 0),
      Animation: Animation(),
      Predator: {
        attackCooldown: 0,
        meals: 0,
        preferredPrey: [],
        huntCooldown: 0,
      },
      LifeLimited: { lifespan, age: 0 },
      Stressable: { resilience: 0.2 },
      DeathFx: { spawned: false },
      Genome: { genotype, phenotype: null },
    });
  }

  // ── DragonflyNymph → DragonflyAdult ────────────────────────────

  _morphToDragonflyAdult(world, x, y, genome) {
    // Slight upward offset — emerging from water
    const offsetX = x + (Math.random() * 10 - 5);
    const offsetY = y - (5 + Math.random() * 15);

    const speed = genome?.genotype
      ? 0.8 + (genome.genotype.THR * 0.5 + genome.genotype.MC1R * 0.3) * 2.2
      : 1.5;
    const lifespan = genome?.genotype
      ? 100 + (genome.genotype.LEP * 0.5 + (genome.genotype.IGF1 || 0.5) * 0.3) * 400
      : 300;
    const agility = Math.min(1.0, 0.5 + speed / 6);

    const newEid = world.createEntity({
      Position: Position(offsetX, offsetY),
      Renderable: Renderable(12, '#6aaa4a', 3),  // radius=12, flying layer
      Species: Species('dragonflyAdult'),
      Age: { age: 0, maxAge: lifespan + 100 },
      Flight: Flight(-25 + Math.random() * 15, 0),
      Steering: Steering(speed, agility, 80),
      Animation: Animation(),
      LifeLimited: { lifespan, age: 0 },
      Stressable: { resilience: 0.2 },
      DeathFx: { spawned: false },
    });

    // Inherit genome from nymph — needed for AgeSystem's addToDragonflyGenePool on release
    if (genome) {
      world.addComponent(newEid, 'Genome', cloneGenome(genome));
    }
  }
}
