// ── MetabolismSystem ─────────────────────────────────────────────────
// ECS Phase 2: Drains satiation and energy based on metabolic rate.
//
// Component Requirements: Energy (+ optionally Species for special logic)
//
// Logic replicated from entity behaviours:
//   Tadpole:   satiation -= metabolism * 0.20 * dt
//              if satiation < 0: energy -= lerp(0.10, 0.35, metabolism) * dt, satiation = 0
//   Froglet:   satiation -= metabolism * 0.16 * dt
//              if satiation < 0: energy -= lerp(0.08, 0.30, metabolism) * dt, satiation = 0
//   DragonflyNymph: satiation -= 0.02 * dt
//              if satiation < 0: energy -= 0.03 * dt, satiation = 0
//
// Growth multipliers (satiation-gated) are handled by GrowthSystem.

import { EcsSystem } from '../engine.js';

export class MetabolismSystem extends EcsSystem {
  constructor() {
    super('MetabolismSystem');
  }

  update(dt, world) {
    const energyStore = world.getStore('Energy');
    const speciesStore = world.getStore('Species');
    if (!energyStore || !speciesStore) return;

    for (const [eid, energy] of energyStore.getAll()) {
      const species = speciesStore.get(eid);
      if (!species) continue;

      const type = species.type;

      // ── Satiation drain rate depends on species ──
      let satiationDrain, energyDrainMin, energyDrainMax, metabolism;

      switch (type) {
        case 'tadpole':
          metabolism = energy.metabolism || 1.0;
          satiationDrain = metabolism * 0.20;
          energyDrainMin = 0.10;
          energyDrainMax = 0.35;
          break;

        case 'froglet':
          metabolism = energy.metabolism || 1.0;
          satiationDrain = metabolism * 0.16;
          energyDrainMin = 0.08;
          energyDrainMax = 0.30;
          break;

        case 'dragonflyNymph':
          metabolism = 1.0; // dragonflies use flat rates
          satiationDrain = 0.02;
          energyDrainMin = 0.03;
          energyDrainMax = 0.03;
          break;

        default:
          // No metabolism for this species type
          continue;
      }

      // ── Apply satiation drain ──
      energy.satiation -= satiationDrain * dt;

      // ── If satiation depleted, drain energy ──
      if (energy.satiation < 0) {
        const drain = energyDrainMin + (energyDrainMax - energyDrainMin) * (energy.metabolism || 1.0);
        energy.energy -= drain * dt;
        energy.satiation = 0;
      }

      // Clamp
      if (energy.energy < 0) energy.energy = 0;
      if (energy.energy > energy.maxEnergy) energy.energy = energy.maxEnergy;
    }
  }
}
