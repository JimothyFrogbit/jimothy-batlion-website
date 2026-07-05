// ── AnimationSystem ──────────────────────────────────────────────────
// ECS: Restores the per-entity `this.phase += dt * rate` (and `.wobble`,
// Flight.wingAngle) increments that every legacy entity did inline in
// its update(). Nothing else in the ECS pipeline touches Animation —
// without this system every creature's tail-wag/wobble/wing-buzz render
// is frozen, and mosquito larvae (which drift via phase, not velocity)
// never move at all.
//
// Logic replicated from entity behaviours:
//   Tadpole:         phase += dt*0.03, wobble += dt*0.05
//   DragonflyNymph:  phase += dt*0.02, wobble += dt*0.04
//   Mosquito:        phase += dt*0.04
//   DragonflyAdult:  phase += dt*0.06, Flight.wingAngle += dt*0.15
//   MosquitoLarva:   phase += dt*0.08, plus direct position wiggle:
//                      y += sin(phase*2)*0.2*dt, x += cos(phase*0.7)*0.1*dt
//
// Component Requirements: Animation + Species
// Optional: Position (mosquitoLarva wiggle), Flight (dragonflyAdult wingAngle)

import { EcsSystem } from '../engine.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

const PHASE_RATE = {
  tadpole: 0.03,
  dragonflyNymph: 0.02,
  mosquito: 0.04,
  dragonflyAdult: 0.06,
  mosquitoLarva: 0.08,
};

const WOBBLE_RATE = {
  tadpole: 0.05,
  dragonflyNymph: 0.04,
};

export class AnimationSystem extends EcsSystem {
  constructor() {
    super('AnimationSystem');
  }

  update(dt, world) {
    const animStore = world.getStore('Animation');
    const speciesStore = world.getStore('Species');
    const posStore = world.getStore('Position');
    const flightStore = world.getStore('Flight');

    if (!animStore || !speciesStore) return;

    for (const [eid, anim] of animStore.getAll()) {
      const species = speciesStore.get(eid);
      if (!species) continue;
      const type = species.type;

      const phaseRate = PHASE_RATE[type];
      if (phaseRate) anim.phase += dt * phaseRate;

      const wobbleRate = WOBBLE_RATE[type];
      if (wobbleRate) anim.wobble += dt * wobbleRate;

      if (type === 'dragonflyAdult' && flightStore && flightStore.has(eid)) {
        flightStore.get(eid).wingAngle += dt * 0.15;
      }

      if (type === 'mosquitoLarva' && posStore && posStore.has(eid)) {
        const pos = posStore.get(eid);
        pos.y += Math.sin(anim.phase * 2) * 0.2 * dt;
        pos.x += Math.cos(anim.phase * 0.7) * 0.1 * dt;
        if (pos.x < POND_X + 3) pos.x = POND_X + 3;
        if (pos.x > POND_X + POND_W - 3) pos.x = POND_X + POND_W - 3;
        if (pos.y < POND_Y + 3) pos.y = POND_Y + 3;
        if (pos.y > POND_Y + POND_H - 3) pos.y = POND_Y + POND_H - 3;
      }
    }
  }
}
