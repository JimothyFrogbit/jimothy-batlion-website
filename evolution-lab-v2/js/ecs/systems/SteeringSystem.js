// ── Steering System ────────────────────────────────────────────────
// Determines direction each critter moves based on its genome:
// - High aggression + low energy → steer toward nearest food source
// - Low aggression + full energy → wander with gentle turns
// - Moderate → mixed behaviour
//
// Phase 3: Prey evasion — critters flee from larger, more aggressive
//          predators. The flee response is proportional to the threat
//          level and the prey's own aggression (less aggressive = more
//          likely to flee).

import { EcsSystem } from '../engine.js';
import { dist, rand } from '../../utils.js';

export class SteeringSystem extends EcsSystem {
  constructor() {
    super('Steering');
  }

  update(dt, world) {
    const [posStore, ccStore, energyStore, foodStore, mouthStore] =
      world.getStores('Position', 'CritterConfig', 'Energy', 'FoodSource', 'Mouth');

    if (!posStore || !ccStore) return;

    // Collect food positions once
    const foodPositions = [];
    if (foodStore) {
      for (const [fid, food] of foodStore.getAll()) {
        if (!world.hasEntity(fid)) continue;
        const fpos = posStore.get(fid);
        if (fpos) foodPositions.push(fpos);
      }
    }

    // Collect all critter info for threat detection
    const allCritters = [];
    if (ccStore) {
      for (const [eid, cc] of ccStore.getAll()) {
        if (!world.hasEntity(eid)) continue;
        const pos = posStore.get(eid);
        const energy = energyStore ? energyStore.get(eid) : null;
        const mouth = mouthStore ? mouthStore.get(eid) : null;
        if (pos) {
          allCritters.push({ eid, cc, pos, energy, mouth });
        }
      }
    }

    const W = 800, H = 600;

    for (const [eid, pos] of posStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      const cc = ccStore.get(eid);
      if (!cc) continue;

      const energy = energyStore ? energyStore.get(eid) : null;
      const mouth = mouthStore ? mouthStore.get(eid) : null;

      // ── Phase 3: Prey evasion — flee from threats ──────────────
      let fleeVector = null;

      if (allCritters.length > 1) {
        const detectionRange = cc.detectionRange * 30 + 15;

        for (const other of allCritters) {
          if (other.eid === eid) continue;              // skip self
          if (!world.hasEntity(other.eid)) continue;    // skip dead
          if (!other.mouth) continue;                   // no mouth = can't eat us

          // Is this critter a threat?
          // 1. Its mouthGape exceeds our bodySize (it CAN eat us)
          // 2. Its aggression is higher than ours (it MIGHT eat us)
          // 3. It's within detection range
          const canEatUs = other.mouth.gape > cc.bodySize * 5 + 1;
          const isAggressive = other.cc.aggression > cc.aggression;
          if (!canEatUs || !isAggressive) continue;

          const d = dist(pos, other.pos);
          if (d > detectionRange) continue;

          // Calculate threat level: how dangerous is this predator?
          const threatLevel = (other.cc.aggression - cc.aggression) +
                              (other.cc.bodySize - cc.bodySize) * 0.5 +
                              (1 - d / detectionRange) * 0.5;

          if (threatLevel > 0.3) {
            // Flee vector: steer AWAY from the predator
            const dx = pos.x - other.pos.x;
            const dy = pos.y - other.pos.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              const fleeStrength = Math.min(threatLevel * 0.8, 1.0);
              if (fleeVector === null) {
                fleeVector = { x: (dx / len) * fleeStrength, y: (dy / len) * fleeStrength };
              } else {
                // Accumulate flee vectors (multiple threats)
                fleeVector.x += (dx / len) * fleeStrength;
                fleeVector.y += (dy / len) * fleeStrength;
              }
            }
          }
        }
      }

      // ── Phase 1/3: Food-seeking vs wandering ───────────────────
      if (fleeVector !== null) {
        // FLEEING takes priority over everything
        pos.vx += fleeVector.x * 0.5;
        pos.vy += fleeVector.y * 0.5;

      } else {
        // Normal behaviour: food-seeking vs wandering
        const hunger = energy ? 1 - (energy.energy / energy.maxEnergy) : 1;
        const seekThreshold = cc.aggression * 0.5 + hunger * 0.4;

        if (seekThreshold > 0.5 && foodPositions.length > 0) {
          // Seek nearest food
          const range = cc.detectionRange * 40 + 20;
          let nearest = null;
          let nearestDist = range;
          for (const fp of foodPositions) {
            const d = dist(pos, fp);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = fp;
            }
          }
          if (nearest) {
            const dx = nearest.x - pos.x;
            const dy = nearest.y - pos.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
              pos.vx += (dx / len) * 0.3;
              pos.vy += (dy / len) * 0.3;
            }
          } else {
            pos.vx += rand(-0.1, 0.1);
            pos.vy += rand(-0.1, 0.1);
          }
        } else {
          // Wander with gentle drift
          if (Math.random() < 0.02) {
            pos.vx += rand(-0.1, 0.1);
            pos.vy += rand(-0.1, 0.1);
          }
        }
      }

      // Clamp velocity magnitude
      const maxSpeed = cc.speed * 0.5 + 0.3;
      const vlen = Math.hypot(pos.vx, pos.vy);
      if (vlen > maxSpeed) {
        pos.vx = (pos.vx / vlen) * maxSpeed;
        pos.vy = (pos.vy / vlen) * maxSpeed;
      }

      // Wrap around screen edges
      if (pos.x < -20) pos.x += W + 40;
      if (pos.x > W + 20) pos.x -= W + 40;
      if (pos.y < -20) pos.y += H + 40;
      if (pos.y > H + 20) pos.y -= H + 40;
    }
  }
}
