// ── MovementSystem ───────────────────────────────────────────────────
// ECS Phase 2: Updates Position from velocity with boundary clamping.
// Handles submerged entities (tadpole, froglet, etc.), flying entities
// (mosquito, dragonflyAdult), drifters (food, particles), and particles.
//
// Component Requirements by entity type:
//   All: Position + Species
//   Submerged swimmers: Position + Steering (vx damping 0.94-0.96)
//   Flying: Flight (separate flightY from visual y)
//   Particles: ParticleState (gravity, decay)
//
// Pond bounds: POND_X=20, POND_Y=20, POND_W=660, POND_H=660

import { EcsSystem } from '../engine.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class MovementSystem extends EcsSystem {
  constructor() {
    super('MovementSystem');
  }

  update(dt, world) {
    // Cache component references
    const posStore = world.getStore('Position');
    const speciesStore = world.getStore('Species');
    const steeringStore = world.getStore('Steering');
    const flightStore = world.getStore('Flight');
    const particleStore = world.getStore('ParticleState');
    const renderStore = world.getStore('Renderable');

    if (!posStore || !speciesStore) return;

    for (const [eid, pos] of posStore.getAll()) {
      const species = speciesStore.get(eid);
      if (!species) continue;

      const type = species.type;
      const hasSteering = steeringStore && steeringStore.has(eid);
      const hasFlight = flightStore && flightStore.has(eid);
      const hasParticle = particleStore && particleStore.has(eid);

      // ── Apply velocity to position ──
      if (hasFlight) {
        // Flying entities: flightY is the "ground-track", y is visual.
        // x has no such split — apply vx directly, same as legacy Mosquito/DragonflyAdult.
        const flight = flightStore.get(eid);
        pos.x += pos.vx * dt;
        pos.flightY = (pos.flightY !== undefined ? pos.flightY : pos.y) + pos.vy * dt;
        pos.y = pos.flightY + flight.altitude;
      } else {
        pos.x += pos.vx * dt;
        pos.y += pos.vy * dt;
      }

      // ── Velocity damping ──
      if (hasSteering) {
        // Submerged swimmers: moderate damping (0.94-0.96)
        pos.vx *= 0.96;
        pos.vy *= 0.96;
      } else if (hasFlight) {
        // Flying entities: lighter damping with erratic motion
        pos.vx *= 0.97;
        pos.vy *= 0.97;
      }
      // Food/drifters: no damping (keep drifting)

      // ── Speed limit (steering entities) ──
      if (hasSteering) {
        const steer = steeringStore.get(eid);
        const spd = Math.hypot(pos.vx, pos.vy);
        let maxSpeed = steer.speed;

        // Froglets can jump — higher speed cap
        if (type === 'froglet') {
          maxSpeed = steer.speed + 3;
        }

        if (spd > maxSpeed) {
          pos.vx = (pos.vx / spd) * maxSpeed;
          pos.vy = (pos.vy / spd) * maxSpeed;
        }
      }
      if (hasFlight) {
        const spd = Math.hypot(pos.vx, pos.vy);
        if (spd > 2.0) { // mosquito max speed
          pos.vx = (pos.vx / spd) * 2.0;
          pos.vy = (pos.vy / spd) * 2.0;
        }
      }

      // ── Boundary clamping ──
      if (hasFlight) {
        // Mosquito: x stays in pond, flightY has extended range
        const margin = 5;
        if (pos.x < POND_X + margin) { pos.x = POND_X + margin; pos.vx *= -1; }
        if (pos.x > POND_X + POND_W - margin) { pos.x = POND_X + POND_W - margin; pos.vx *= -1; }
        if (pos.flightY < POND_Y - 30) { pos.flightY = POND_Y - 30; pos.vy *= -1; }
        if (pos.flightY > POND_Y + POND_H + 30) { pos.flightY = POND_Y + POND_H + 30; pos.vy *= -1; }
      } else if (hasParticle) {
        // Particles: no boundary clamping (they float freely)
        // (handled by ParticleSystem life decay)
      } else {
        // Submerged / drifting entities
        const r = renderStore ? (renderStore.get(eid)?.radius || 4) : 4;
        if (pos.x < POND_X + r) { pos.x = POND_X + r; pos.vx *= -0.5; }
        if (pos.x > POND_X + POND_W - r) { pos.x = POND_X + POND_W - r; pos.vx *= -0.5; }
        if (pos.y < POND_Y + r) { pos.y = POND_Y + r; pos.vy *= -0.5; }
        if (pos.y > POND_Y + POND_H - r) { pos.y = POND_Y + POND_H - r; pos.vy *= -0.5; }
      }

      // ── Recalc visual radius from Growth for growing entities ──
      if (renderStore && renderStore.has(eid)) {
        const growthStore = world.getStore('Growth');
        if (growthStore && growthStore.has(eid)) {
          const growth = growthStore.get(eid);
          // Renderable radius is recalculated in RenderSystem (Phase 3)
          // For Phase 2, Position stores the current visual size
        }
      }
    }
  }
}
