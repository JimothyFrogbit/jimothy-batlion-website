// ── Feeding System ─────────────────────────────────────────────────
// Phase 1: Critters eat static FoodSource entities (algae).
// Phase 3: Emergent predation — critters with high aggression + big gape
//          eat smaller critters. Predation is a genome-emergent behaviour,
//          not a hardcoded species flag.
//
// Predation triggers when:
//   1. Critter has Mouth component with gape > 0
//   2. Target critter's bodySize < predator's mouthGape
//   3. Predator is hungry enough (energy < 80%) OR aggression is very high
//   4. Target is within detection range
//
// Energy transfer: predator gains energy proportional to prey's bodySize.
// Prey is marked for death. Predation has a cooldown to prevent chain-eating.

import { EcsSystem } from '../engine.js';
import { dist } from '../../utils.js';

export class FeedingSystem extends EcsSystem {
  constructor() {
    super('Feeding');
  }

  update(dt, world) {
    const [posStore, ccStore, energyStore, foodStore, mouthStore] =
      world.getStores('Position', 'CritterConfig', 'Energy', 'FoodSource', 'Mouth');

    if (!posStore || !energyStore) return;

    // Phase 1: Collect food source positions (algae / plants)
    const foodPositions = [];
    if (foodStore) {
      for (const [fid, food] of foodStore.getAll()) {
        if (!world.hasEntity(fid)) continue;
        const fpos = posStore.get(fid);
        if (fpos) foodPositions.push({ fid, ...food, ...fpos });
      }
    }

    // Phase 3: Collect critter positions for predation
    const critterPositions = [];
    if (ccStore) {
      for (const [eid, cc] of ccStore.getAll()) {
        if (!world.hasEntity(eid)) continue;
        const pos = posStore.get(eid);
        const energy = energyStore.get(eid);
        if (pos && energy) {
          critterPositions.push({ eid, cc, pos, energy });
        }
      }
    }

    if (foodPositions.length === 0 && critterPositions.length < 2) return;

    // Each critter eats from nearest food source within range
    for (const [eid, pos] of posStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      const cc = ccStore ? ccStore.get(eid) : null;
      if (!cc) continue; // not a critter

      const energy = energyStore.get(eid);
      if (!energy) continue;

      // Skip if already full
      if (energy.energy >= energy.maxEnergy * 0.95) continue;

      const mouth = mouthStore ? mouthStore.get(eid) : null;

      // ── Phase 1: Eat from food sources ──────────────────────────
      if (foodPositions.length > 0) {
        const range = cc.detectionRange * 30 + 30;
        let nearest = null;
        let nearestDist = range;

        for (const food of foodPositions) {
          const d = dist(pos, food);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = food;
          }
        }

        if (nearest && nearestDist < cc.mouthGape * 15 + 10) {
          energy.energy = Math.min(energy.maxEnergy, energy.energy + nearest.nutrition);
          // Ate this tick — skip predation (can't do both)
          continue;
        }
      }

      // ── Phase 3: Emergent Predation ─────────────────────────────
      if (critterPositions.length < 2) continue;
      if (!mouth) continue;
      if (mouth.eatCooldown > 0) {
        mouth.eatCooldown--;
        continue;
      }

      // Predation threshold: high aggression OR hungry AND moderately aggressive
      const hunger = 1 - (energy.energy / energy.maxEnergy);
      const willPredate = cc.aggression > 0.55 || (cc.aggression > 0.35 && hunger > 0.4);

      if (!willPredate) continue;

      // Find nearest prey within detection range
      const range = cc.detectionRange * 40 + 20;
      let nearestPrey = null;
      let nearestDist = range;

      for (const prey of critterPositions) {
        if (prey.eid === eid) continue;              // skip self
        if (!world.hasEntity(prey.eid)) continue;     // already dead
        if (prey.energy.energy <= 0) continue;        // already dying

        // Can we eat this critter? mouthGape must exceed prey's bodySize
        if (mouth.gape < prey.cc.bodySize * 6 + 2) continue;

        // Don't eat critters with higher aggression (risk of injury)
        if (prey.cc.aggression > cc.aggression + 0.15) continue;

        const d = dist(pos, prey.pos);
        if (d < nearestDist) {
          nearestDist = d;
          nearestPrey = prey;
        }
      }

      if (nearestPrey) {
        // Eat the prey: energy transfer proportional to body size
        const preyEnergy = nearestPrey.cc.bodySize * 12 + nearestPrey.cc.metabolism * 5;
        energy.energy = Math.min(energy.maxEnergy, energy.energy + preyEnergy);

        // Mark prey for death
        world.markDead(nearestPrey.eid);

        // Both parties learn from this encounter
        // Predator gets a cooldown (can't eat again immediately)
        mouth.eatCooldown = 15 + Math.floor(Math.random() * 10);

        // The predator's aggression is reinforced (slight heritability bump)
        // This happens naturally through reproduction success
      }
    }
  }
}
