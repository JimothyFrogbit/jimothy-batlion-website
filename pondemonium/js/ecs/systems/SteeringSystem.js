// ── SteeringSystem ───────────────────────────────────────────────────
// ECS Phase 3: Self-contained ECS query-based target finding.
// No longer depends on pondRef or old entity arrays.
//
// Manages target selection, steering, wandering, and species-specific
// movement patterns (jump impulses, erratic flight).
//
// Component Requirements: Steering + TargetSeek + Position + Species
//
// Phase 3 changes:
//   - Removed pondRef dependency
//   - Target selection queries ECS component stores directly
//   - Food found via Position + Species + Nutrition + Renderable
//   - Prey found via Position + Species + (Energy/Age for type matching)
//
// ── Behaviours ────────────────────────────────────────────────────────
//   - steerToward: velocity blending with momentum
//   - selectTarget: hysteresis + lock timer persistence (legacy, unused)
//   - Wander: random direction changes
//   - Froglet jump: occasional burst impulse
//   - Mosquito erratic flight: random velocity perturbations

import { EcsSystem } from '../engine.js';
import { rand } from '../../utils.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class SteeringSystem extends EcsSystem {
  constructor() {
    super('SteeringSystem');
  }

  update(dt, world) {
    const posStore = world.getStore('Position');
    const speciesStore = world.getStore('Species');
    const steeringStore = world.getStore('Steering');
    const targetSeekStore = world.getStore('TargetSeek');
    const flightStore = world.getStore('Flight');

    if (!posStore || !speciesStore || !steeringStore) return;

    // Pre-filter entities that need steering
    const queryIds = world.query('Steering', 'Position', 'Species');

    for (const eid of queryIds) {
      const pos = posStore.get(eid);
      const species = speciesStore.get(eid);
      const steer = steeringStore.get(eid);
      const targetSeek = targetSeekStore ? targetSeekStore.get(eid) : null;
      const hasFlight = flightStore && flightStore.has(eid);
      const type = species.type;

      // Decrement timers
      if (targetSeek) {
        targetSeek.lockTimer = (targetSeek.lockTimer || 0) - 1;
        targetSeek.targetTimer = (targetSeek.targetTimer || 0) - dt;
      }

      // Species-specific behaviour
      switch (type) {
        case 'tadpole':
          this._handleTadpoleSteering(pos, steer, targetSeek, dt, eid, world);
          break;
        case 'froglet':
          this._handleFrogletSteering(pos, steer, targetSeek, dt, eid, world);
          break;
        case 'dragonflyNymph':
          this._handleDragonflySteering(pos, steer, targetSeek, dt, eid, world);
          break;
        case 'mosquito':
          this._handleMosquitoSteering(pos, steer, dt, hasFlight);
          break;
        // Drifters (food, particles) and non-moving don't need steering
        default:
          break;
      }
    }
  }

  // ── Steer current velocity toward target position ──
  _steerToward(pos, steer, tx, ty, dt) {
    const dx = tx - pos.x;
    const dy = ty - pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const desiredVx = (dx / d) * steer.speed;
    const desiredVy = (dy / d) * steer.speed;
    const blend = steer.agility * 0.08;
    pos.vx += (desiredVx - pos.vx) * blend;
    pos.vy += (desiredVy - pos.vy) * blend;
  }

  // ── ECS Query-based target finding ──────────────────────────────────
  // Phase 3: Replaces _findNearestInArray(pond.xxx, ...)
  //
  // Queries the ECS world for entities with requiredStores that match
  // speciesType, filtering by maxDist and optional filter function.
  // Returns the queryData entry { entityId, StoreName: data, ... } or null.
  _findNearestInECS(pos, world, requiredStores, speciesType, maxDist, filter) {
    const candidates = world.queryData(...requiredStores);
    let best = null;
    let bestD = maxDist;

    for (const c of candidates) {
      // Skip dead entities (marked for death but not yet reaped)
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

  // ── Tadpole: seek food ──
  _handleTadpoleSteering(pos, steer, targetSeek, dt, eid, world) {
    // Query food entities from ECS: Position + Species('food') + Nutrition + Renderable
    const mouthStore = world.getStore('Mouth');
    const mouth = mouthStore ? mouthStore.get(eid) : null;
    const gape = mouth ? mouth.gape : 3;

    const filter = (c) => {
      const r = c.Renderable ? c.Renderable.radius : 4;
      return r <= gape + 1;
    };

    const nearest = this._findNearestInECS(
      pos, world, ['Position', 'Species', 'Nutrition', 'Renderable'],
      'food', steer.sight, filter
    );

    if (nearest && nearest.Position) {
      this._steerToward(pos, steer, nearest.Position.x, nearest.Position.y, dt);
    } else {
      // Wander
      if (targetSeek.targetTimer <= 0) {
        targetSeek.targetDir = rand(0, Math.PI * 2);
        targetSeek.targetTimer = rand(30, 120);
      }
      pos.vx += Math.cos(targetSeek.targetDir) * 0.05 * dt;
      pos.vy += Math.sin(targetSeek.targetDir) * 0.05 * dt;
    }
  }

  // ── Froglet: seek food OR mosquitoes, with jump impulse ──
  _handleFrogletSteering(pos, steer, targetSeek, dt, eid, world) {
    const mouthStore = world.getStore('Mouth');
    const mouth = mouthStore ? mouthStore.get(eid) : null;
    const gape = mouth ? mouth.gape : 3;

    // Prefer mosquitoes over food
    const nearestMosquito = this._findNearestInECS(
      pos, world, ['Position', 'Species'],
      'mosquito', steer.sight * 0.8, null
    );

    const foodFilter = (c) => {
      const r = c.Renderable ? c.Renderable.radius : 4;
      return r <= gape + 2;
    };
    const nearestFood = this._findNearestInECS(
      pos, world, ['Position', 'Species', 'Nutrition', 'Renderable'],
      'food', steer.sight, foodFilter
    );

    let target = null;
    if (nearestMosquito) target = nearestMosquito;
    else if (nearestFood) target = nearestFood;

    if (target && target.Position) {
      this._steerToward(pos, steer, target.Position.x, target.Position.y, dt);
    } else {
      // Wander
      if (targetSeek.targetTimer <= 0) {
        targetSeek.targetDir = rand(0, Math.PI * 2);
        targetSeek.targetTimer = rand(30, 120);
      }
      pos.vx += Math.cos(targetSeek.targetDir) * 0.04 * steer.agility * dt;
      pos.vy += Math.sin(targetSeek.targetDir) * 0.04 * steer.agility * dt;
    }

    // Jump impulse
    const jumpStore = world.getStore('Jump');
    if (jumpStore && jumpStore.has(eid)) {
      const jump = jumpStore.get(eid);
      jump.cooldown = (jump.cooldown || 0) - dt;
      if (jump.cooldown <= 0 && Math.random() < 0.005 * dt) {
        const angle = rand(0, Math.PI * 2);
        pos.vx += Math.cos(angle) * rand(2, 5);
        pos.vy += Math.sin(angle) * rand(2, 5);
        jump.cooldown = rand(20, 60);
      }
    }
  }

  // ── Dragonfly Nymph: hunt tadpoles + mosquito larvae ──
  _handleDragonflySteering(pos, steer, targetSeek, dt, eid, world) {
    // Hunt tadpoles first (preferred), then mosquito larvae
    // Query all potential prey from ECS stores
    const sight = steer.sight;

    // Try tadpoles first
    const nearestTadpole = this._findNearestInECS(
      pos, world, ['Position', 'Species', 'Energy'],
      'tadpole', sight, null
    );

    if (nearestTadpole && nearestTadpole.Position) {
      this._steerToward(pos, steer, nearestTadpole.Position.x, nearestTadpole.Position.y, dt);
      return;
    }

    // Then mosquito larvae
    const nearestLarva = this._findNearestInECS(
      pos, world, ['Position', 'Species', 'Energy'],
      'mosquitoLarva', sight, null
    );

    if (nearestLarva && nearestLarva.Position) {
      this._steerToward(pos, steer, nearestLarva.Position.x, nearestLarva.Position.y, dt);
      return;
    }

    // Wander if no prey found
    if (targetSeek.targetTimer <= 0) {
      targetSeek.targetDir = rand(0, Math.PI * 2);
      targetSeek.targetTimer = rand(60, 200);
    }
    pos.vx += Math.cos(targetSeek.targetDir) * 0.03 * steer.agility * dt;
    pos.vy += Math.sin(targetSeek.targetDir) * 0.03 * steer.agility * dt;
  }

  // ── Mosquito: erratic random flight ──
  _handleMosquitoSteering(pos, steer, dt, hasFlight) {
    // Erratic random perturbations
    pos.vx += rand(-1, 1) * 0.1 * steer.agility * dt;
    pos.vy += rand(-1, 1) * 0.1 * steer.agility * dt;
  }
}
