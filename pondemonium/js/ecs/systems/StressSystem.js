// ── StressSystem ─────────────────────────────────────────────────────
// ECS Phase 3: Self-manages stress event timers and applies damage.
//
// Manages its own event timer, trigger schedule, and lifecycle.
// No pondRef dependency — fully self-contained.
//
// Component Requirements:
//   Damaged: Energy + Species + (Stressable for submerged entities)
//
// Logic replicated from pond.processStressEventTick():
//   Submerged/ground entities: damage = sev * (1-resilience)^2 * t
//     drains satiation first (×2), then energy
//   Flying entities (mosquito, dragonflyAdult): damage = sev * flightFactor * t
//     (flightFactor: 0.3 for mosquitoes, 0.2 for dragonflies)
//     FLYING ENTITIES EXEMPT FROM DROUGHT
//
// Particles spawned at event start (mirrored from triggerStressEvent):
//   12 event-coloured particles in burst pattern (upward, drifting)

import { EcsSystem } from '../engine.js';
import { Position, Renderable, Species, ParticleState } from '../components.js';
import { rand, randInt } from '../../utils.js';

/** Flying species take reduced stress damage (except during drought). */
const FLIGHT_DAMAGE_FACTOR = {
  mosquito: 0.3,
  dragonflyAdult: 0.2,
};

/** Species whose Energy gets damaged by stress events. */
const GROUND_SPECIES = new Set([
  'tadpole', 'froglet', 'mosquitoLarva', 'dragonflyNymph',
  'frogSpawn', 'mosquitoEgg',
]);

const FLYING_SPECIES = new Set(['mosquito', 'dragonflyAdult']);

// ── Stress Event Types ───────────────────────────────────────────────
const STRESS_EVENTS = [
  { id: 'tempSpike', name: '🌡️ TEMPERATURE SPIKE', color: '#ff6a00', duration: 60, severity: 0.035 },
  { id: 'pHShift',   name: '🧪 pH SHIFT',         color: '#aa44ff', duration: 80, severity: 0.025 },
  { id: 'toxinBloom', name: '☣️ TOXIN BLOOM',      color: '#44dd44', duration: 50, severity: 0.040 },
  { id: 'drought',    name: '🏜️ DROUGHT',          color: '#cccc88', duration: 100, severity: 0.020 },
];

export class StressSystem extends EcsSystem {
  constructor(config = {}) {
    super('StressSystem');
    // Event management — self-contained
    this._activeEvent = null;
    this._stressTimer = 0;
    this._stressEventRate = config.stressEventRate ?? 1; // 0 = disabled
    this._eventsSurvived = 0;
    this._eventsTotal = 0;
    this._eventLog = []; // [{time, name, color, duration, survived, severity}]
    this._simulationTime = 0;
  }

  /** Get the currently active event (for pond UI / stats overlay). */
  get activeEvent() {
    return this._activeEvent;
  }

  /** Get the event log for UI display. */
  get eventLog() {
    return this._eventLog;
  }

  /** Get survived/total counts. */
  get eventsSurvived() { return this._eventsSurvived; }
  get eventsTotal() { return this._eventsTotal; }

  /** Called on reset — clears all state. */
  reset() {
    this._activeEvent = null;
    this._stressTimer = 0;
    this._eventsSurvived = 0;
    this._eventsTotal = 0;
    this._eventLog = [];
    this._simulationTime = 0;
  }

  /** Reset event log on reset. */
  clearLog() {
    this._eventLog = [];
  }

  update(dt, world) {
    this._simulationTime += dt;

    // ── Timer: auto-trigger stress events ──
    if (this._stressEventRate > 0) {
      this._stressTimer += dt * (this._stressEventRate / 6);
      if (!this._activeEvent && this._stressTimer > 180) {
        this._stressTimer = 0;
        this._triggerEvent();
      }
    }

    // ── Active event lifecycle ──
    const event = this._activeEvent;
    if (!event) return;

    event.elapsed += dt;

    // Auto-clear when duration expires
    if (event.elapsed >= event.duration) {
      this._eventsSurvived++;
      for (const entry of this._eventLog) {
        if (entry.survived === null) { entry.survived = true; break; }
      }
      this._activeEvent = null;
      return;
    }

    const sev = event.severity;
    const eventId = event.id;

    const energyStore = world.getStore('Energy');
    const speciesStore = world.getStore('Species');
    const stressableStore = world.getStore('Stressable');

    if (!energyStore || !speciesStore) return;

    // ── Damage submerged/ground entities ──
    // These have Stressable (resilience) + Energy + Species
    if (stressableStore) {
      const groundIds = world.query('Energy', 'Species', 'Stressable');
      for (const eid of groundIds) {
        const species = speciesStore.get(eid);
        if (!species || !GROUND_SPECIES.has(species.type)) continue;

        const energy = energyStore.get(eid);
        if (!energy) continue;

        const stressable = stressableStore.get(eid);
        const resilience = stressable ? stressable.resilience : 0.3;

        // Damage scales quadratically with vulnerability
        const vulnerability = 1 - resilience;
        const damage = sev * vulnerability * vulnerability * dt;

        if (damage > 0) {
          // Stress drains satiation first, then energy
          if (energy.satiation != null) {
            const satDrain = Math.min(energy.satiation, damage * 2);
            energy.satiation -= satDrain;
          }
          if (energy.energy != null) {
            energy.energy -= damage;
          }
        }
      }
    }

    // ── Damage flying entities (reduced, exempt from drought) ──
    if (eventId !== 'drought') {
      const flightIds = world.query('Energy', 'Species');
      for (const eid of flightIds) {
        const species = speciesStore.get(eid);
        if (!species || !FLYING_SPECIES.has(species.type)) continue;

        const energy = energyStore.get(eid);
        if (!energy) continue;

        const factor = FLIGHT_DAMAGE_FACTOR[species.type] || 0.3;
        energy.energy -= sev * factor * dt;
      }
    }

    // ── Spawn ECS particles when a new event starts ──
    // Detected by checking if elapsed is close to 0 (fresh event)
    if (event.elapsed < dt * 1.5) {
      this._spawnEventParticles(world, eventId, event.color);
    }
  }

  /** Trigger a random stress event. */
  _triggerEvent() {
    const event = STRESS_EVENTS[randInt(0, STRESS_EVENTS.length - 1)];
    this._activeEvent = { ...event, elapsed: 0 };
    this._eventsTotal++;
    this._eventLog.unshift({
      time: this._simulationTime,
      name: event.name,
      color: event.color,
      duration: event.duration,
      survived: null,  // null=in-progress, true=ended
      severity: event.severity,
    });
    if (this._eventLog.length > 10) this._eventLog.pop();
  }

  /**
   * Spawn 12 ECS particles at random pond positions to indicate event start.
   * Mirrors pond.triggerStressEvent() particle spawning.
   */
  _spawnEventParticles(world, eventId, color) {
    const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;
    for (let i = 0; i < 12; i++) {
      const peid = world.createEntity({
        Position: Position(
          rand(POND_X + 20, POND_X + POND_W - 20),
          rand(POND_Y + 20, POND_Y + POND_H - 20)
        ),
        Renderable: Renderable(
          rand(3, 6),
          color,
          4
        ),
        Species: Species('particle'),
        ParticleState: ParticleState(
          rand(30, 60),       // life
          60,                  // maxLife
          rand(3, 6),          // size
          -0.005,              // gravity (negative = upward)
          'dot',
          color
        ),
      });
      // Apply random upward velocity
      const ppos = world.getComponent(peid, 'Position');
      if (ppos) {
        ppos.vx = rand(-0.5, 0.5);
        ppos.vy = rand(-1, 0);
      }
    }
  }

  /** Record an entity death during the current stress event. */
  recordDeath() {
    for (const entry of this._eventLog) {
      if (entry.survived === null) {
        entry.deaths = (entry.deaths || 0) + 1;
        break;
      }
    }
  }
}
