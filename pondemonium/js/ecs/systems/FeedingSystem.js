// ── FeedingSystem ────────────────────────────────────────────────────
// ECS Phase 3: Self-contained ECS query-based feeding.
// No longer depends on pondRef or old entity arrays.
//
// Handles all entity feeding interactions:
//   1. Tadpoles + Froglets eat algae (Food)
//   2. Froglets eat Mosquitoes
//   3. Dragonfly Nymphs hunt tadpoles/larvae
//
// Phase 3 changes:
//   - Removed pondRef dependency
//   - Prey/food found via ECS queries (Position + Species + relevant stores)
//   - Consumed prey is marked dead via world.markDead()
//   - Death particles spawned inline (absorbed from PredationSystem)
//
// Component Requirements:
//   Primary: Mouth + Energy + Position + Species
//   Optional: Predator (dragonfly nymph attack logic)
//   Optional: Growth (dragonfly nymph growth-on-meal)
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
import { Position, Renderable, Species, ParticleState } from '../components.js';

const DEATH_COLORS = {
  tadpole:        'hsla(30, 40%, 25%, 0.4)',
  mosquitoLarva:  'hsla(30, 40%, 25%, 0.4)',
  mosquito:       'hsla(0, 0%, 50%, 0.3)',
  food:           'hsla(120, 30%, 40%, 0.3)',
  default:        'hsla(30, 30%, 30%, 0.4)',
};

export class FeedingSystem extends EcsSystem {
  constructor() {
    super('FeedingSystem');
  }

  update(dt, world) {
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
          this._tryEatAlgae(pos, mouth, energy, 'tadpole', world);
          break;

        case 'froglet':
          // Froglets prefer mosquitoes over algae
          if (!this._tryEatMosquito(pos, energy, world)) {
            this._tryEatAlgae(pos, mouth, energy, 'froglet', world);
          }
          break;

        case 'dragonflyNymph':
          if (predator) {
            this._tryHunt(pos, energy, predator, growth, dt, world);
          }
          break;

        default:
          break;
      }
    }
  }

  // ── ECS Query Helpers ──────────────────────────────────────────────

  /**
   * Find the nearest ECS entity matching species type within maxDist.
   * Optionally filtered by a custom filter function.
   * Returns { entityId, Position, ...components } or null.
   */
  _findNearestInECS(pos, world, requiredStores, speciesType, maxDist, filter) {
    const candidates = world.queryData(...requiredStores);
    let best = null;
    let bestD = maxDist;

    for (const c of candidates) {
      // Skip dead entities
      if (!world.hasEntity(c.entityId)) continue;

      // Filter by species type if specified
      if (speciesType && (!c.Species || c.Species.type !== speciesType)) continue;

      // Apply optional custom filter
      if (filter && !filter(c)) continue;

      const cx = c.Position ? c.Position.x : 0;
      const cy = c.Position ? c.Position.y : 0;
      const d = Math.hypot(pos.x - cx, pos.y - cy);

      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }

    return best;
  }

  /**
   * Mark a prey entity as dead and spawn death particles.
   */
  _killPrey(world, preyEid, preyX, preyY, preyType) {
    if (world.hasEntity(preyEid)) {
      world.markDead(preyEid);
    }

    // Spawn death particles
    const color = DEATH_COLORS[preyType] || DEATH_COLORS.default;
    for (let i = 0; i < 4; i++) {
      const peid = world.createEntity({
        Position: Position(preyX, preyY),
        Renderable: Renderable(
          1 + Math.random(),
          color,
          4  // top layer
        ),
        Species: Species('particle'),
        ParticleState: ParticleState(
          15 + Math.random() * 10,  // life
          25,                        // maxLife
          1 + Math.random(),         // size
          0.01,                      // gravity
          'dot',
          color
        ),
      });
      // Apply random velocity — particles spray outward
      const ppos = world.getComponent(peid, 'Position');
      if (ppos) {
        ppos.vx = (Math.random() - 0.5) * 1.5;
        ppos.vy = 0.1 + Math.random() * 0.3;
      }
    }
  }

  // ── Algae / Filter Feeding ─────────────────────────────────────────

  /**
   * Attempt to eat algae (Food) via ECS query.
   *
   * Tadpole size check: food.radius <= mouth.gape + 1
   * Froglet size check: food.radius <= mouth.gape + 2
   */
  _tryEatAlgae(pos, mouth, energy, eaterType, world) {
    const gape = mouth.gape || 3;
    const sizeTolerance = eaterType === 'froglet' ? 2 : 1;
    const eaterRadius = eaterType === 'froglet' ? 10 : 4;

    const filter = (c) => {
      const r = c.Renderable ? c.Renderable.radius : 4;
      return r <= gape + sizeTolerance;
    };

    const nearest = this._findNearestInECS(
      pos, world,
      ['Position', 'Species', 'Nutrition', 'Renderable'],
      'food', eaterRadius * 3,  // search within 3x body length
      filter
    );

    if (!nearest || !nearest.Position) return false;

    const d = Math.hypot(pos.x - nearest.Position.x, pos.y - nearest.Position.y);
    if (d >= eaterRadius + (nearest.Renderable ? nearest.Renderable.radius : 4)) return false;

    // ── Update satiation ──
    const nutrition = nearest.Nutrition ? nearest.Nutrition.value : 5;
    if (eaterType === 'froglet') {
      energy.satiation = Math.min(100, energy.satiation + nutrition * 1.5);
    } else {
      // Tadpole: metabolism > 0.8 reduces efficiency
      const efficiency = energy.metabolism > 0.8 ? 0.7 : 1.2;
      energy.satiation = Math.min(100, energy.satiation + nutrition * efficiency);
    }

    // Kill the food entity
    this._killPrey(world, nearest.entityId, nearest.Position.x, nearest.Position.y, 'food');
    return true;
  }

  // ── Mosquito Hunting (Froglets) ────────────────────────────────────

  /**
   * Attempt to eat a mosquito via ECS query.
   *
   * Vertical bounds: dy ∈ (-30, 10)  (mosquito within leap range)
   * Proximity: eater.radius + 10
   * Satiation gain: 20
   */
  _tryEatMosquito(pos, energy, world) {
    const nearest = this._findNearestInECS(
      pos, world,
      ['Position', 'Species'],
      'mosquito', 20,  // search within froglet.radius (10) + 10
      null
    );

    if (!nearest || !nearest.Position) return false;

    const dy = nearest.Position.y - pos.y;
    if (dy > -30 && dy < 10) {
      const d = Math.hypot(pos.x - nearest.Position.x, pos.y - nearest.Position.y);
      if (d < 20) {  // froglet.radius (10) + 10
        energy.satiation = Math.min(100, energy.satiation + 20);

        // Kill the mosquito
        this._killPrey(world, nearest.entityId, nearest.Position.x, nearest.Position.y, 'mosquito');
        return true;
      }
    }
    return false;
  }

  // ── Predatory Hunting (Dragonfly Nymphs) ──────────────────────────

  /**
   * Attempt to hunt prey via ECS query.
   *
   * Order: Tadpoles first (preferred), then MosquitoLarvae.
   * Cooldown: 20 ticks after eating a tadpole, 15 after larva.
   * On tadpole kill: satiation +30, growth +0.08, meals++
   * On larva kill:   satiation +15, growth +0.04, meals++
   */
  _tryHunt(pos, energy, predator, growth, dt, world) {
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
    const nearestTadpole = this._findNearestInECS(
      pos, world,
      ['Position', 'Species', 'Energy'],
      'tadpole', nymphRadius + 4 + 10,  // nymphRadius + max tadpole radius + buffer
      (c) => {
        const r = c.Renderable ? c.Renderable.radius : 4;
        return true;  // all tadpoles are valid
      }
    );

    if (nearestTadpole && nearestTadpole.Position) {
      const d = Math.hypot(pos.x - nearestTadpole.Position.x, pos.y - nearestTadpole.Position.y);
      const preyRadius = nearestTadpole.Renderable ? nearestTadpole.Renderable.radius : 4;
      if (d < nymphRadius + preyRadius + 4) {
        energy.satiation = Math.min(100, energy.satiation + 30);
        if (growth) {
          growth.growth = Math.min(1, growth.growth + 0.08);
        }
        predator.meals = (predator.meals || 0) + 1;
        predator.attackCooldown = 20;

        // Kill prey
        this._killPrey(world, nearestTadpole.entityId, nearestTadpole.Position.x, nearestTadpole.Position.y, 'tadpole');
        return true;
      }
    }

    // ── Then mosquito larvae ──
    const nearestLarva = this._findNearestInECS(
      pos, world,
      ['Position', 'Species', 'Energy'],
      'mosquitoLarva', nymphRadius + 3 + 5,  // nymphRadius + max larva radius + buffer
      null
    );

    if (nearestLarva && nearestLarva.Position) {
      const d = Math.hypot(pos.x - nearestLarva.Position.x, pos.y - nearestLarva.Position.y);
      const preyRadius = nearestLarva.Renderable ? nearestLarva.Renderable.radius : 3;
      if (d < nymphRadius + preyRadius + 3) {
        energy.satiation = Math.min(100, energy.satiation + 15);
        if (growth) {
          growth.growth = Math.min(1, growth.growth + 0.04);
        }
        predator.meals = (predator.meals || 0) + 1;
        predator.attackCooldown = 15;

        // Kill prey
        this._killPrey(world, nearestLarva.entityId, nearestLarva.Position.x, nearestLarva.Position.y, 'mosquitoLarva');
        return true;
      }
    }

    return false;
  }
}
