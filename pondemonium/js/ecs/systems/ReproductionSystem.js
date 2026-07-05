// ── ReproductionSystem ───────────────────────────────────────────────
// ECS Phase 3: Self-contained reproduction with own timers and config.
//
// Handles four spawn types:
//   Frog spawn (frogSpawn)     — every ~80 frames, pond-edge, genome
//   Mosquito eggs (mosquitoEgg) — every ~60 frames, internal, no genome
//   Dragonfly nymphs            — every ~120 frames, pond-edge, genome
//   Food (algae)               — every ~15 frames, internal, genome
//
// No pondRef dependency. Rates configurable via constructor.
// Entity count caps use ECS queries.
//
// Component Requirements (spawned entities):
//   frogSpawn: Position + Renderable + Species + Age + Genome +
//              FrogSpawnTiming + EdgeSpawn + Stressable + DeathFx
//   mosquitoEgg: Position + Renderable + Species + Age + EggSpawn +
//                EdgeSpawn + Stressable + DeathFx
//   dragonflyNymph: Position + Renderable + Species + Age + Growth +
//                   Energy + Mouth + Steering + TargetSeek + Predator +
//                   Animation + Stressable + DeathFx + Genome
//   food: Position + Renderable + Species + Age + Nutrition + Genome

import { EcsSystem } from '../engine.js';
import {
  Position, Renderable, Species, Age, Growth, Energy, Mouth,
  Steering, TargetSeek, Predator, Animation, EggSpawn,
  FrogSpawnTiming, Stressable, DeathFx, Nutrition, Genome,
  EdgeSpawn,
} from '../components.js';
import { rand, randInt } from '../../utils.js';
import { createFood } from '../factories.js';
import { FROG_SPAWN_INCUBATION, MOSQUITO_EGG_INCUBATION } from '../balance.js';
import {
  sampleGenePool, sampleAlgaeGenePool, sampleDragonflyGenePool,
} from '../../genome.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

/** Clamp position to pond boundaries with margin. */
function clampPond(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class ReproductionSystem extends EcsSystem {
  constructor(config = {}) {
    super('ReproductionSystem');

    // Spawn rates — configurable with defaults matching pond.js
    this._frogRate = config.frogRate ?? 7;
    this._mosquitoRate = config.mosquitoRate ?? 8;
    this._dragonflyRate = config.dragonflyRate ?? 5;
    this._algaeRate = config.algaeRate ?? 10;

    // Season cycle — self-managed, starts in spring (same as pond.js)
    this._seasonCycle = 0.25;
    this._seasonCycleSpeed = config.seasonCycleSpeed ?? 0.00005;

    // Spawn caps — without these, nothing bounds population growth except
    // predation/lifespan, so a long session (or sliders cranked up) can
    // produce runaway tadpole/froglet/mosquito counts that directly drive
    // per-tick CPU cost (profiled: ECS tick time scales with population,
    // see ecs/perf-bench.mjs). Generous enough not to be noticeable in
    // normal play — they're a safety net, not a difficulty limiter.
    this._maxFood = config.maxFood ?? 250;
    this._maxDragonflyNymphs = config.maxDragonflyNymphs ?? 12;
    this._maxFrogLineage = config.maxFrogLineage ?? 150; // frogSpawn + tadpole + froglet
    this._maxMosquitoLineage = config.maxMosquitoLineage ?? 150; // mosquitoLarva + mosquito

    // Internal timers
    this._frogTimer = 0;
    this._mosquitoTimer = 0;
    this._dragonflyTimer = 0;
    this._algaeTimer = 0;
  }

  /** Update rates at runtime (e.g. when user changes sliders). */
  setFrogRate(v) { this._frogRate = v; }
  setMosquitoRate(v) { this._mosquitoRate = v; }
  setDragonflyRate(v) { this._dragonflyRate = v; }
  setAlgaeRate(v) { this._algaeRate = v; }

  /** Reset all timers (e.g. on pond reset). */
  reset() {
    this._frogTimer = 0;
    this._mosquitoTimer = 0;
    this._dragonflyTimer = 0;
    this._algaeTimer = 0;
    this._seasonCycle = 0.25;
  }

  /** Count entities of a given species type via ECS query. */
  _countBySpecies(world, type) {
    const speciesStore = world.getStore('Species');
    if (!speciesStore) return 0;
    let count = 0;
    for (const eid of world.query('Species')) {
      const s = speciesStore.get(eid);
      if (s && s.type === type) count++;
    }
    return count;
  }

  update(dt, world) {
    // Advance season cycle (same rate as pond.js)
    this._seasonCycle = (this._seasonCycle + dt * this._seasonCycleSpeed) % 1;
    const seasonIdx = Math.floor(this._seasonCycle * 4);

    // Seasonal multipliers (mirrors pond.js _processSeasons)
    const frogMult  = seasonIdx === 1 ? 0.8 : seasonIdx === 3 ? 0.9 : 1.0;
    const mosquitoMult = seasonIdx === 1 ? 1.3 : seasonIdx === 3 ? 0.5 : 1.0;
    const algaeMult = seasonIdx === 1 ? 1.6 : seasonIdx === 3 ? 0.4 : 1.0;

    // ── Frog Reproduction ──
    this._frogTimer += dt * (this._frogRate / 10) * frogMult;
    const frogLineageCount = this._countBySpecies(world, 'frogSpawn')
      + this._countBySpecies(world, 'tadpole') + this._countBySpecies(world, 'froglet');
    if (this._frogTimer > 80 && frogLineageCount < this._maxFrogLineage) {
      this._frogTimer = 0;
      this._spawnFrogSpawn(world);
    }

    // ── Mosquito Reproduction ──
    this._mosquitoTimer += dt * (this._mosquitoRate / 10) * (this._mosquitoRate > 0 ? mosquitoMult : 1);
    const mosquitoLineageCount = this._countBySpecies(world, 'mosquitoLarva') + this._countBySpecies(world, 'mosquito');
    if (this._mosquitoTimer > 60 && mosquitoLineageCount < this._maxMosquitoLineage) {
      this._mosquitoTimer = 0;
      this._spawnMosquitoEgg(world);
    }

    // ── Dragonfly Reproduction ──
    this._dragonflyTimer += dt * (this._dragonflyRate / 10);
    const nymphCount = this._countBySpecies(world, 'dragonflyNymph');
    if (this._dragonflyTimer > 120 && nymphCount < this._maxDragonflyNymphs) {
      this._dragonflyTimer = 0;
      this._spawnDragonflyNymph(world);
    }

    // ── Algae (Food) Reproduction ──
    this._algaeTimer += dt * (this._algaeRate / 10) * algaeMult;
    const foodCount = this._countBySpecies(world, 'food');
    if (this._algaeTimer > 15 && foodCount < this._maxFood) {
      this._algaeTimer = 0;
      const n = randInt(1, 3);
      for (let i = 0; i < n; i++) {
        this._spawnFood(world);
      }
    }
  }

  // ── Frog Spawn ───────────────────────────────────────────────────────

  _spawnFrogSpawn(world) {
    const edge = randInt(0, 3);
    let x, y;
    switch (edge) {
      case 0: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y - 5; break;
      case 1: x = POND_X + POND_W + 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
      case 2: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y + POND_H + 5; break;
      case 3: x = POND_X - 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
    }
    const cx = clampPond(x, POND_X + 15, POND_X + POND_W - 15);
    const cy = clampPond(y, POND_Y + 15, POND_Y + POND_H - 15);

    const genotype = sampleGenePool();
    const incubation = FROG_SPAWN_INCUBATION;

    world.createEntity({
      Position: Position(cx, cy),
      Renderable: Renderable(6, null, 1),
      Species: Species('frogSpawn'),
      Age: { age: 0, maxAge: incubation * 6 },
      Genome: { genotype, phenotype: null },
      FrogSpawnTiming: { incubation, hatchTimer: incubation, clusterCount: randInt(3, 6) },
      EdgeSpawn: { genotype },
      Stressable: { resilience: 0.3 },
      DeathFx: { spawned: false },
    });
  }

  // ── Mosquito Eggs ────────────────────────────────────────────────────

  _spawnMosquitoEgg(world) {
    const x = rand(POND_X + 15, POND_X + POND_W - 15);
    const y = rand(POND_Y + 15, POND_Y + POND_H - 15);

    world.createEntity({
      Position: Position(x, y),
      Renderable: Renderable(5, null, 1),
      Species: Species('mosquitoEgg'),
      Age: { age: 0, maxAge: Infinity },
      EggSpawn: { eggCount: randInt(8, 18), incubation: rand(...MOSQUITO_EGG_INCUBATION), timer: 0, driftX: rand(-0.05, 0.05) },
      EdgeSpawn: { genotype: null },
      Stressable: { resilience: 0.3 },
      DeathFx: { spawned: false },
    });
  }

  // ── Dragonfly Nymph ─────────────────────────────────────────────────

  _spawnDragonflyNymph(world) {
    const edge = randInt(0, 3);
    let x, y;
    switch (edge) {
      case 0: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y - 5; break;
      case 1: x = POND_X + POND_W + 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
      case 2: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y + POND_H + 5; break;
      case 3: x = POND_X - 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
    }
    const cx = clampPond(x, POND_X + 15, POND_X + POND_W - 15);
    const cy = clampPond(y, POND_Y + 15, POND_Y + POND_H - 15);

    const genotype = sampleDragonflyGenePool();
    const { THR, MC1R, LEP } = genotype;
    const speed = 0.5 + (THR * 0.5 + MC1R * 0.3) * 1.1;
    const sight = 50 + (MC1R * 0.5 + (genotype.POU1F1 || 0) * 0.3) * 130;
    const attackCooldown = 10 + (LEP * 0.4 + (1 - THR) * 0.3) * 30;
    const agility = Math.max(0.4, 1.0 - 9 / 12);

    world.createEntity({
      Position: Position(cx, cy),
      Renderable: Renderable(9, null, 1),
      Species: Species('dragonflyNymph'),
      Age: { age: 0, maxAge: Infinity },
      Growth: { growth: 0, maxSize: 12, growthRate: 0.001, targetEntityType: null },
      Energy: { energy: 100, maxEnergy: 100, satiation: 100, metabolism: 1.0 },
      Mouth: { gape: 6, diet: 'tadpole', eatCooldown: 0 },
      Steering: { speed, agility, sight },
      TargetSeek: {
        lockedTargetId: null, lockTimer: 0, lockDuration: 45,
        targetDir: rand(0, Math.PI * 2), targetTimer: rand(60, 200),
        hysteresis: 0.85,
      },
      Predator: { attackCooldown, meals: 0, preferredPrey: ['tadpole', 'mosquitoLarva'], huntCooldown: 0 },
      Animation: { phase: rand(0, Math.PI * 2), wobble: rand(0, 1000), bobPhase: rand(0, Math.PI * 2) },
      Genome: { genotype, phenotype: null },
      Stressable: { resilience: 0.3 },
      DeathFx: { spawned: false },
    });
  }

  // ── Food (Algae) ─────────────────────────────────────────────────────

  _spawnFood(world) {
    const x = rand(POND_X + 10, POND_X + POND_W - 10);
    const y = rand(POND_Y + 10, POND_Y + POND_H - 10);
    createFood(world, x, y, sampleAlgaeGenePool());
  }
}