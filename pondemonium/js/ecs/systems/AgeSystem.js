// ── AgeSystem ────────────────────────────────────────────────────────
// ECS: Restores the per-entity `this.age += dt` that every legacy entity
// class did inline in its update(). Nothing else in the ECS pipeline
// increments Age.age or LifeLimited.age — without this system, froglets
// never reach the age>600 gate ReleaseSystem checks, algae never expires,
// and mosquitoes/dragonfly adults live forever.
//
// Logic replicated from entity behaviours:
//   Food:            if age > maxAge → die, addToAlgaeGenePool(genome)
//   Mosquito:         if age > life  → die, mosquitoesReleased++,
//                                      humansBitten += rand(2,8), addToMosquitoGenePool
//   DragonflyAdult:   if age > life  → die, dragonfliesReleased++, addToDragonflyGenePool
//
// Component Requirements: Age (age increment for all entities that have it)
// Optional: LifeLimited (natural-death lifespan for mosquito/dragonflyAdult)

import { EcsSystem } from '../engine.js';
import { randInt } from '../../utils.js';
import { addToAlgaeGenePool, addToMosquitoGenePool, addToDragonflyGenePool } from '../../genome.js';

export class AgeSystem extends EcsSystem {
  constructor() {
    super('AgeSystem');
    this._mosquitoesReleased = 0;
    this._humansBitten = 0;
    this._dragonfliesReleased = 0;
  }

  /** Reset internal counters (called on pond reset). */
  reset() {
    this._mosquitoesReleased = 0;
    this._humansBitten = 0;
    this._dragonfliesReleased = 0;
  }

  /** Get current natural-death stats for pond consumption. */
  getAgeStats() {
    return {
      mosquitoesReleased: this._mosquitoesReleased,
      humansBitten: this._humansBitten,
      dragonfliesReleased: this._dragonfliesReleased,
    };
  }

  update(dt, world) {
    const ageStore = world.getStore('Age');
    const speciesStore = world.getStore('Species');
    const genomeStore = world.getStore('Genome');
    const lifeLimitedStore = world.getStore('LifeLimited');

    if (!ageStore || !speciesStore) return;

    // ── Increment age for every entity that has it ──
    for (const [eid, age] of ageStore.getAll()) {
      age.age += dt;
    }

    // ── Increment LifeLimited age for flying/limited-life entities ──
    if (lifeLimitedStore) {
      for (const [, limited] of lifeLimitedStore.getAll()) {
        limited.age += dt;
      }
    }

    // ── Species-specific old-age death (snapshot to avoid mutation-during-iteration) ──
    const toKill = [];
    for (const [eid, age] of ageStore.getAll()) {
      const species = speciesStore.get(eid);
      if (!species) continue;

      if (species.type === 'food' && isFinite(age.maxAge) && age.age > age.maxAge) {
        toKill.push({ eid, type: 'food' });
      }
    }
    if (lifeLimitedStore) {
      for (const [eid, limited] of lifeLimitedStore.getAll()) {
        const species = speciesStore.get(eid);
        if (!species) continue;
        if ((species.type === 'mosquito' || species.type === 'dragonflyAdult') && limited.age > limited.lifespan) {
          toKill.push({ eid, type: species.type });
        }
      }
    }

    for (const { eid, type } of toKill) {
      if (!world.hasEntity(eid)) continue;
      const genome = genomeStore ? genomeStore.get(eid) : null;

      if (type === 'food') {
        if (genome && genome.genotype) addToAlgaeGenePool(genome.genotype);
      } else if (type === 'mosquito') {
        this._mosquitoesReleased++;
        this._humansBitten += randInt(2, 8);
        if (genome && genome.genotype) addToMosquitoGenePool(genome.genotype);
      } else if (type === 'dragonflyAdult') {
        this._dragonfliesReleased++;
        if (genome && genome.genotype) addToDragonflyGenePool(genome.genotype);
      }

      world.markDead(eid);
    }
  }
}
