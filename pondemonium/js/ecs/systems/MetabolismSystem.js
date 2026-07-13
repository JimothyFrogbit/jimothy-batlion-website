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
import { MATURATION_SLOWDOWN } from '../balance.js';
import { fitnessScore, expressGenome, getSelectionScheme } from '../../genome.js';

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
          // Scaled by MATURATION_SLOWDOWN alongside growth rate (see
          // balance.js) — growth is gated by satiation>50, so slowing
          // growth WITHOUT also slowing hunger creates a feedback loop:
          // a slower-growing tadpole spends longer in a food-scarce
          // state, which caps its growth rate further via that same
          // gate, which keeps it a tadpole even longer — empirically
          // this stalled growth around ~0.15-0.20 forever at 4x with
          // metabolism left alone (see git history / _diag.mjs). Scaling
          // both together keeps "time to starve vs. time to mature"
          // proportional, so slower literally means slower, not stuck.
          metabolism = energy.metabolism || 1.0;
          satiationDrain = (metabolism * 0.20) / MATURATION_SLOWDOWN;
          energyDrainMin = 0.10 / MATURATION_SLOWDOWN;
          energyDrainMax = 0.35 / MATURATION_SLOWDOWN;
          break;

        case 'froglet':
          metabolism = energy.metabolism || 1.0;
          satiationDrain = (metabolism * 0.16) / MATURATION_SLOWDOWN;
          energyDrainMin = 0.08 / MATURATION_SLOWDOWN;
          energyDrainMax = 0.30 / MATURATION_SLOWDOWN;
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
        let extraDrain = 0;
        // Scheme III: Death selection — less-fit individuals drain faster when starving
        if (getSelectionScheme() === 'III' && energy.energy < energy.maxEnergy * 0.5) {
          const genomeStore = world.getStore('Genome');
          if (genomeStore) {
            const genome = genomeStore.get(eid);
            if (genome && genome.genotype) {
              const fitness = fitnessScore(expressGenome(genome.genotype));
              extraDrain = (1 - fitness) * 0.15; // up to 15% extra drain for the least fit
            }
          }
        }
        energy.energy -= (drain + extraDrain) * dt;
        energy.satiation = 0;
      }

      // Clamp
      if (energy.energy < 0) energy.energy = 0;
      if (energy.energy > energy.maxEnergy) energy.energy = energy.maxEnergy;
    }
  }
}
