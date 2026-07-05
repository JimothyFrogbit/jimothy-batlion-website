// ── DeathSystem ─────────────────────────────────────────────────────
// ECS Phase 2b: Checks for entities with depleted energy and marks them
// for cleanup. In Phase 2 this mirrors the old entity death logic.
// Phase 3 will add particle spawning and stress event recording here.
//
// Component Requirements:
//   Primary: Energy + Species
//   Optional: DeathFx (tracks whether death particles have been spawned)
//
// Logic replicated from entity behaviours:
//   Tadpole/Froglet/DragonflyNymph:
//     if energy <= 0 → mark dead, flag death FX as spawned
//   (Particle spawning handled by old entity code in Phase 2)
//
// Stress events: in Phase 2, these are tracked by the old entity code.
// The ECS DeathSystem records the death state for Phase 3 readiness.

import { EcsSystem } from '../engine.js';
import { Position, Renderable, Species, ParticleState } from '../components.js';

const DEATH_COLORS = {
  tadpole:         'hsla(30, 40%, 25%, 0.5)',
  froglet:         'hsla(30, 40%, 25%, 0.5)',
  dragonflyNymph:  'hsla(160, 50%, 30%, 0.4)',
  // Default for unknown species
  default:         'hsla(30, 30%, 30%, 0.4)',
};

export class DeathSystem extends EcsSystem {
  constructor() {
    super('DeathSystem');
  }

  update(dt, world) {
    const energyStore = world.getStore('Energy');
    const speciesStore = world.getStore('Species');
    const deathFxStore = world.getStore('DeathFx');
    const posStore = world.getStore('Position');

    if (!energyStore || !speciesStore) return;

    const toMarkDead = [];

    for (const [eid, energy] of energyStore.getAll()) {
      // Only process entities with depleted energy
      if (energy.energy > 0) continue;

      const species = speciesStore.get(eid);
      if (!species) continue;

      // Check if death FX have already been spawned
      let deathFx = deathFxStore ? deathFxStore.get(eid) : null;
      if (!deathFx && deathFxStore) {
        // Add DeathFx component on first tick of death
        deathFxStore.add(eid, { spawned: true });
      } else if (deathFx && !deathFx.spawned) {
        deathFx.spawned = true;
      }

      // ── Phase 2: Spawn ECS particle entities for future RenderSystem ──
      // These mirror the particles the old entity code creates.
      // In Phase 2 they live alongside but don't render yet.
      if (posStore && posStore.has(eid)) {
        const pos = posStore.get(eid);
        const type = species.type;
        const color = DEATH_COLORS[type] || DEATH_COLORS.default;
        const particleCount = type === 'dragonflyNymph' ? 4 : 5;

        for (let i = 0; i < particleCount; i++) {
          const peid = world.createEntity({
            Position: Position(pos.x, pos.y),
            Renderable: Renderable(
              1.5 + Math.random(),
              color,
              4  // top layer
            ),
            Species: Species('particle'),
            ParticleState: ParticleState(
              15 + Math.random() * 15,  // life
              30,                        // maxLife
              1 + Math.random() * 1.5,   // size
              0.01,                      // gravity
              'dot',
              color
            ),
          });
          // Apply random velocity
          const ppos = world.getComponent(peid, 'Position');
          if (ppos) {
            ppos.vx = (Math.random() - 0.5) * 2;
            ppos.vy = 0.1 + Math.random() * 0.4;
          }
        }
      }

      // Mark for death (will be cleaned up by world.reapDead())
      toMarkDead.push(eid);
    }

    // Mark all dead entities — they'll be cleaned up by world.reapDead()
    for (const eid of toMarkDead) {
      world.markDead(eid);
    }
  }
}
