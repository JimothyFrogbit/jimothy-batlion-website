// ── PredationSystem ──────────────────────────────────────────────────
// ECS Phase 3: Self-contained ECS query-based predation.
// No longer depends on pondRef or old entity arrays.
//
// Handles prey death from predator attacks. Dragonfly nymphs (the only
// predators) search for tadpoles and mosquito larvae via ECS component
// queries, kill them, and spawn death particles.
//
// Phase 3 changes:
//   - Removed pondRef dependency
//   - Prey found via ECS queries (Position + Species + Energy)
//   - Only touches ECS world — no old entity arrays
//
// Separate from FeedingSystem:
//   FeedingSystem    → updates the PREDATOR's stats (satiation, growth, cooldown)
//   PredationSystem  → handles the PREY's death (markDead, death particles)
//
// Component Requirements:
//   Predators: Predator + Position + Species + Energy
//   Prey targets: Tadpoles (Position + Species('tadpole') + Energy)
//                 MosquitoLarvae (Position + Species('mosquitoLarva') + Energy)

import { EcsSystem } from '../engine.js';
import { Position, Renderable, Species, ParticleState } from '../components.js';

const DEATH_COLORS = {
  tadpole:        'hsla(30, 40%, 25%, 0.4)',
  mosquitoLarva:  'hsla(30, 40%, 25%, 0.4)',
  default:        'hsla(30, 30%, 30%, 0.4)',
};

export class PredationSystem extends EcsSystem {
  constructor() {
    super('PredationSystem');
  }

  update(dt, world) {
    const predatorStore = world.getStore('Predator');
    const energyStore = world.getStore('Energy');
    const posStore = world.getStore('Position');
    const speciesStore = world.getStore('Species');

    if (!predatorStore || !energyStore || !posStore || !speciesStore) return;

    // Get all dragonfly nymphs (entities with Predator + Energy + Position + Species)
    const predators = world.query('Predator', 'Energy', 'Position', 'Species');

    for (const eid of predators) {
      const species = speciesStore.get(eid);
      if (!species || species.type !== 'dragonflyNymph') continue;

      const predator = predatorStore.get(eid);
      const energy = energyStore.get(eid);
      const pos = posStore.get(eid);

      if (!predator || !energy || !pos) continue;

      // Skip if in cooldown
      if (predator.attackCooldown > 0) continue;

      const nymphRadius = 9;
      let killed = false;

      // ── Try tadpoles first (preferred prey) via ECS query ──
      const tadpoleCandidates = world.queryData('Position', 'Species', 'Energy');
      for (const c of tadpoleCandidates) {
        if (c.Species && c.Species.type === 'tadpole' && world.hasEntity(c.entityId)) {
          const d = Math.hypot(pos.x - c.Position.x, pos.y - c.Position.y);
          if (d < nymphRadius + (c.Renderable ? c.Renderable.radius : 4) + 4) {
            this._markPreyDead(world, c.entityId, c.Position.x, c.Position.y, 'tadpole');
            killed = true;
            break;
          }
        }
      }

      if (killed) continue;

      // ── Then mosquito larvae via ECS query ──
      for (const c of tadpoleCandidates) {
        if (c.Species && c.Species.type === 'mosquitoLarva' && world.hasEntity(c.entityId)) {
          const d = Math.hypot(pos.x - c.Position.x, pos.y - c.Position.y);
          if (d < nymphRadius + (c.Renderable ? c.Renderable.radius : 3) + 3) {
            this._markPreyDead(world, c.entityId, c.Position.x, c.Position.y, 'mosquitoLarva');
            killed = true;
            break;
          }
        }
      }
    }
  }

  /**
   * Mark a prey entity as dead in the ECS world and spawn death particles.
   */
  _markPreyDead(world, preyEid, preyX, preyY, preyType) {
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
}
