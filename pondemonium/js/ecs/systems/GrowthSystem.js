// ── GrowthSystem ────────────────────────────────────────────────────
// ECS Phase 2: Handles maturation / size progression for growing entities.
//
// For each entity with a Growth component, increments `growth` based on
// species-specific rate and satiation-gating, then updates the Renderable
// radius to reflect current size.
//
// Component Requirements: Growth + Species + Renderable
// Optional: Energy (for satiation-gated growth in tadpoles/froglets)
//
// Logic replicated from entity behaviours:
//   Tadpole:        growth += growthRate * dt * (satiation > 50 ? 1 : 0.3)
//                   radius = lerp(4, maxSize, growth)
//   Froglet:        growth += growthRate * dt * (satiation > 50 ? 1 : 0.3)
//                   radius = lerp(10, maxSize, growth)
//   MosquitoLarva:  growth += growthRate * dt                           (no satiation gate)
//                   radius = lerp(2, 5, growth)
//   DragonflyNymph: no growth increment in old code (age-based metamorphosis only)
//   FrogSpawn:      uses hatchTimer, not growth component
//
// Metamorphosis logic (growth >= 1 → transform) is handled by MorphSystem (Phase 2b).

import { EcsSystem } from '../engine.js';

/** Species-specific growth parameters. */
const GROWTH_CONFIG = {
  tadpole: {
    radiusMin: 4,
    useSatiation: true,
    satiationGate: 50,
    gateMultiplier: 0.3,
  },
  froglet: {
    radiusMin: 10,
    useSatiation: true,
    satiationGate: 50,
    gateMultiplier: 0.3,
  },
  mosquitoLarva: {
    radiusMin: 2,
    radiusMax: 5,
    useSatiation: false,
  },
  // DragonflyNymph: no growth increment (age-based)
};

export class GrowthSystem extends EcsSystem {
  constructor() {
    super('GrowthSystem');
  }

  update(dt, world) {
    const growthStore = world.getStore('Growth');
    const speciesStore = world.getStore('Species');
    const energyStore = world.getStore('Energy');
    const renderStore = world.getStore('Renderable');

    if (!growthStore || !speciesStore || !renderStore) return;

    for (const [eid, growth] of growthStore.getAll()) {
      const species = speciesStore.get(eid);
      if (!species) continue;

      const type = species.type;
      const cfg = GROWTH_CONFIG[type];
      if (!cfg) continue;

      // ── Guard: don't grow past maturity ──
      if (growth.growth >= 1) continue;

      // ── Increment growth ──
      if (cfg.useSatiation && energyStore && energyStore.has(eid)) {
        const energy = energyStore.get(eid);
        const gate = energy.satiation > cfg.satiationGate ? 1 : cfg.gateMultiplier;
        growth.growth += growth.growthRate * dt * gate;
      } else {
        growth.growth += growth.growthRate * dt;
      }

      // Clamp
      if (growth.growth > 1) growth.growth = 1;

      // ── Update visual radius ──
      const renderable = renderStore.get(eid);
      if (!renderable) continue;

      switch (type) {
        case 'tadpole':
          renderable.radius = cfg.radiusMin + (growth.maxSize - cfg.radiusMin) * growth.growth;
          break;
        case 'froglet':
          renderable.radius = cfg.radiusMin + (growth.maxSize - cfg.radiusMin) * growth.growth;
          break;
        case 'mosquitoLarva':
          renderable.radius = cfg.radiusMin + (cfg.radiusMax - cfg.radiusMin) * growth.growth;
          break;
      }
    }
  }
}
