// ── FeedingSystem ────────────────────────────────────────────────────
// ECS Phase 2b: Handles all entity feeding interactions.
//
// Replicates three feeding patterns from pond.js:
//   1. processEating()              — Tadpoles + Froglets eat algae (Food)
//   2. processMosquitoEating()      — Froglets eat Mosquitoes
//   3. processDragonflyEating()     — Dragonfly Nymphs hunt tadpoles/larvae
//
// Component Requirements:
//   Primary: Mouth + Energy + Position + Species
//   Optional: Predator (dragonfly nymph attack logic)
//   Optional: Growth (dragonfly nymph growth-on-meal)
//
// Phase 2: Reads old entity arrays via pondRef (old code is still
// source of truth). Updates ECS Energy.satiation to mirror old code
// behaviour. Phase 3 will switch to pure ECS queries and drive the
// actual feeding/marking.
//
// ── Feeding Rules ────────────────────────────────────────────────────
//
// | Eater            | Diet            | Prey           | Sat gain | Growth |
// |------------------|-----------------|----------------|----------|--------|
// | Tadpole          | algae           | Food           | nut * eff | —      |
// | Froglet          | algae+mosquito  | Food           | nut * 1.5 | —      |
// | Froglet          | mosquito        | Mosquito       | 20        | —      |
// | DragonflyNymph   | tadpole         | Tadpole        | 30        | +0.08  |
// | DragonflyNymph   | mosquitoLarva   | MosquitoLarva  | 15        | +0.04  |

import { EcsSystem } from '../engine.js';
import { rand } from '../../utils.js';

export class FeedingSystem extends EcsSystem {
  constructor(pondRef) {
    super('FeedingSystem');
    this._pond = pondRef;
  }

  update(dt, world) {
    const pond = this._pond;
    if (!pond) return;

    const mouthStore = world.getStore('Mouth');
    const energyStore = world.getStore('Energy');
    const posStore = world.getStore('Position');
    const speciesStore = world.getStore('Species');
    const predatorStore = world.getStore('Predator');
    const growthStore = world.getStore('Growth');

    if (!mouthStore || !energyStore || !posStore || !speciesStore) return;

    const feedingEntities = world.query('Mouth', 'Energy', 'Position', 'Species');

    for (const eid of feedingEntities) {
      const mouth = mouthStore.get(eid);
      const energy = energyStore.get(eid);
      const pos = posStore.get(eid);
      const species = speciesStore.get(eid);
      const predator = predatorStore ? predatorStore.get(eid) : null;
      const growth = growthStore ? growthStore.get(eid) : null;

      if (!mouth || !energy || !pos || !species) continue;

      switch (species.type) {
        case 'tadpole':
          this._tryEatAlgae(pond, pos, mouth, energy, 'tadpole');
          break;

        case 'froglet':
          // Froglets prefer mosquitoes over algae
          if (!this._tryEatMosquito(pond, pos, energy)) {
            this._tryEatAlgae(pond, pos, mouth, energy, 'froglet');
          }
          break;

        case 'dragonflyNymph':
          if (predator) {
            this._tryHunt(pond, pos, energy, predator, growth, dt);
          }
          break;

        default:
          break;
      }
    }
  }

  // ── Algae / Filter Feeding ─────────────────────────────────────────

  /**
   * Attempt to eat algae (Food). Mirrors pond.processEating() for
   * tadpoles and froglets.
   *
   * Tadpole size check: food.radius <= mouth.gape + 1
   * Froglet size check: food.radius <= mouth.gape + 2
   * Proximity: eater.radius + food.radius overlap
   *
   * Tadpole nutrition efficiency: metabolisim > 0.8 → 0.7×, else 1.2×
   * Froglet nutrition: 1.5×
   */
  _tryEatAlgae(pond, pos, mouth, energy, eaterType) {
    if (!pond.food || pond.food.length === 0) return false;

    const gape = mouth.gape || 3;
    const sizeTolerance = eaterType === 'froglet' ? 2 : 1;
    const eaterRadius = eaterType === 'froglet' ? 10 : 4;

    for (const food of pond.food) {
      if (!food.alive) continue;
      if (food.radius > gape + sizeTolerance) continue;

      const d = Math.hypot(pos.x - food.x, pos.y - food.y);
      if (d < eaterRadius + food.radius) {
        // ── Update ECS Energy.satiation to mirror old code ──
        const nutrition = food.nutrition || 5;
        if (eaterType === 'froglet') {
          energy.satiation = Math.min(100, energy.satiation + nutrition * 1.5);
        } else {
          // Tadpole: metabolism > 0.8 reduces efficiency
          const efficiency = energy.metabolism > 0.8 ? 0.7 : 1.2;
          energy.satiation = Math.min(100, energy.satiation + nutrition * efficiency);
        }
        return true;
      }
    }
    return false;
  }

  // ── Mosquito Hunting (Froglets) ────────────────────────────────────

  /**
   * Attempt to eat a mosquito. Mirrors pond.processMosquitoEating().
   *
   * Vertical bounds: dy ∈ (-30, 10)  (mosquito within leap range)
   * Proximity: eater.radius + 10
   * Satiation gain: 20
   */
  _tryEatMosquito(pond, pos, energy) {
    if (!pond.mosquitoes || pond.mosquitoes.length === 0) return false;

    for (const mosquito of pond.mosquitoes) {
      if (!mosquito.alive) continue;

      const dy = mosquito.y - pos.y;
      if (dy > -30 && dy < 10) {
        const d = Math.hypot(pos.x - mosquito.x, pos.y - mosquito.y);
        if (d < 20) {  // froglet.radius (10) + 10
          energy.satiation = Math.min(100, energy.satiation + 20);
          return true;
        }
      }
    }
    return false;
  }

  // ── Predatory Hunting (Dragonfly Nymphs) ──────────────────────────

  /**
   * Attempt to hunt prey. Mirrors pond.processDragonflyEating().
   *
   * Order: Tadpoles first (preferred), then MosquitoLarvae.
   * Cooldown: 20 ticks after eating a tadpole, 15 after larva.
   * On tadpole kill: satiation +30, growth +0.08, meals++
   * On larva kill:   satiation +15, growth +0.04, meals++
   */
  _tryHunt(pond, pos, energy, predator, growth, dt) {
    // Tick cooldowns
    if (predator.attackCooldown > 0) {
      predator.attackCooldown -= 1;
      if (predator.attackCooldown < 0) predator.attackCooldown = 0;
    }
    if (predator.huntCooldown > 0) {
      predator.huntCooldown -= dt;
    }

    if (predator.attackCooldown > 0) return false;

    const nymphRadius = 9;

    // ── Try tadpoles first (preferred prey) ──
    if (pond.tadpoles) {
      for (const prey of pond.tadpoles) {
        if (!prey.alive) continue;
        const d = Math.hypot(pos.x - prey.x, pos.y - prey.y);
        if (d < nymphRadius + prey.radius + 4) {
          energy.satiation = Math.min(100, energy.satiation + 30);
          if (growth) {
            growth.growth = Math.min(1, growth.growth + 0.08);
          }
          predator.meals = (predator.meals || 0) + 1;
          predator.attackCooldown = 20;
          return true;
        }
      }
    }

    // ── Then mosquito larvae ──
    if (pond.mosquitoLarvae) {
      for (const prey of pond.mosquitoLarvae) {
        if (!prey.alive) continue;
        const d = Math.hypot(pos.x - prey.x, pos.y - prey.y);
        if (d < nymphRadius + prey.radius + 3) {
          energy.satiation = Math.min(100, energy.satiation + 15);
          if (growth) {
            growth.growth = Math.min(1, growth.growth + 0.04);
          }
          predator.meals = (predator.meals || 0) + 1;
          predator.attackCooldown = 15;
          return true;
        }
      }
    }

    return false;
  }
}
