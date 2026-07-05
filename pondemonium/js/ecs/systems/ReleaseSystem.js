// ── ReleaseSystem ───────────────────────────────────────────────────
// ECS Phase 3: Handles froglet → genePool release logic.
//
// When a froglet reaches full growth (>=1), is well-fed (>60 satiation),
// and old enough (>600 age), it releases back to the gene pool,
// incrementing generation count and spawning particles + food.
//
// This mirrors the old code in Froglet.js lines 83-97:
//   if (this.growth >= 1 && this.satiation > 60 && this.age > 600) {
//     if (Math.random() < 0.002 * dt * this._jumpDrive) { ... }
//   }
//
// Component Requirements:
//   Query: Growth + Species('froglet') + Position + Energy + Age
//   Optional: Genome (for genePool contribution)
//   Spawned: Particle (x8) + Food (x3)
//
// ── Release Effects ──────────────────────────────────────────────────
// - Mark froglet dead
// - Increment frog release count + generation
// - Add genome to gene pool (if available)
// - Spawn 8 green release particles
// - Spawn 3 food items at release site

import { EcsSystem } from '../engine.js';
import { addToGenePool } from '../../genome.js';
import {
  Position, Renderable, Species, Growth, Energy, Age, Genome,
  ParticleState, Nutrition, EdgeSpawn,
} from '../components.js';
import { rand, randInt } from '../../utils.js';
import { FROGLET_RELEASE_MIN_AGE } from '../balance.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class ReleaseSystem extends EcsSystem {
  constructor() {
    super('ReleaseSystem');
    this._frogsReleased = 0;
    this._generation = 0;
  }

  /** Reset internal release counters (called on pond reset). */
  reset() {
    this._frogsReleased = 0;
    this._generation = 0;
  }

  /** Get current release stats for pond consumption. */
  getReleaseStats() {
    return {
      frogsReleased: this._frogsReleased,
      generation: this._generation,
    };
  }

  update(dt, world) {
    const growthStore = world.getStore('Growth');
    const speciesStore = world.getStore('Species');
    const posStore = world.getStore('Position');
    const energyStore = world.getStore('Energy');
    const ageStore = world.getStore('Age');
    const genomeStore = world.getStore('Genome');

    if (!growthStore || !speciesStore || !posStore || !energyStore || !ageStore) return;

    // Collect candidates (snapshot to avoid modifying during iteration)
    const toRelease = [];

    for (const [eid, growth] of growthStore.getAll()) {
      if (growth.growth < 1) continue;

      const species = speciesStore.get(eid);
      if (!species || species.type !== 'froglet') continue;

      const pos = posStore.get(eid);
      const energy = energyStore.get(eid);
      const age = ageStore.get(eid);
      if (energy.satiation <= 60) continue;
      if (age.age <= FROGLET_RELEASE_MIN_AGE) continue;

      // Random release chance per frame (matching old Froglet.js)
      // base rate: 0.002 * dt, same as old 0.002 * dt * _jumpDrive (avg ~1.0)
      if (Math.random() >= 0.002 * dt) continue;

      const genome = genomeStore ? genomeStore.get(eid) : null;
      toRelease.push({ eid, x: pos.x, y: pos.y, genome });
    }

    // ── Process releases ──
    for (const { eid, x, y, genome } of toRelease) {
      world.markDead(eid);
      this._frogsReleased++;

      // Add genome to gene pool
      if (genome && genome.genotype) {
        addToGenePool(genome.genotype);
      }
      this._generation++;

      // Spawn 8 release particles (green burst)
      for (let i = 0; i < 8; i++) {
        const peid = world.createEntity({
          Position: Position(x, y),
          Renderable: Renderable(
            rand(2, 5),
            'hsla(140, 70%, 60%, 0.7)',
            4  // top layer
          ),
          Species: Species('particle'),
          ParticleState: ParticleState(
            rand(20, 45),    // life
            45,               // maxLife
            rand(2, 5),       // size
            0.04,             // gravity
            'dot',
            'hsla(140, 70%, 60%, 0.7)'
          ),
        });
        const ppos = world.getComponent(peid, 'Position');
        if (ppos) {
          ppos.vx = rand(-2, 2);
          ppos.vy = rand(-3, 0.5);
        }
      }

      // Spawn 3 food items at release site
      for (let i = 0; i < 3; i++) {
        world.createEntity({
          Position: Position(
            x + rand(-10, 10),
            y + rand(-10, 10)
          ),
          Renderable: Renderable(rand(3, 6), null, 1),
          Species: Species('food'),
          Nutrition: { value: 10 + randInt(0, 5) },
          EdgeSpawn: { genotype: null },
        });
      }
    }
  }
}
