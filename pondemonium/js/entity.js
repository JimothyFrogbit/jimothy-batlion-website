// ── Entity Base ──────────────────────────────────────────────────────
import { nextId } from './registry.js';
import { rand, lerp } from './utils.js';

export class Entity {
  constructor(x, y) {
    this.id = nextId();
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.age = 0;
    this.alive = true;
    this.radius = 4;
  }
}

// ── Moving Entity (shared steering + target persistence) ────────────
// Extends Entity with velocity blending (no hairpin turns) and
// time-gated target locking (no flip-flop indecision).
export class MovingEntity extends Entity {
  constructor(x, y) {
    super(x, y);
    this._agility = 1.0;
    this._lockedTarget = null;
    this._lockTimer = 0;
    this._speed = 1;
  }

  // Steer current velocity toward target position using momentum blending.
  // agility=1.0 → tight turns, agility=0.15 → wide sweeping turns.
  steerToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const desiredVx = (dx / d) * this._speed;
    const desiredVy = (dy / d) * this._speed;
    const blend = this._agility * 0.08;
    this.vx += (desiredVx - this.vx) * blend;
    this.vy += (desiredVy - this.vy) * blend;
  }

  // Select a target from an array with persistence:
  // - Lock timer: stays on target for N frames before considering switches
  // - Hysteresis: only switches to a new target that's 15%+ closer
  // - Returns nearest valid target (or null if none)
  selectTarget(candidates, maxDist, lockDuration = 45, filter = null) {
    if (this._lockTimer !== undefined) this._lockTimer--;
    if (this._lockedTarget && (!this._lockedTarget.alive || Math.hypot(this.x - this._lockedTarget.x, this.y - this._lockedTarget.y) > maxDist)) {
      this._lockedTarget = null;
    }
    let best = null, bestD = maxDist;
    for (const c of candidates) {
      if (filter && !filter(c)) continue;
      const d = Math.hypot(this.x - c.x, this.y - c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && this._lockedTarget && best !== this._lockedTarget) {
      if (this._lockTimer > 0) {
        best = this._lockedTarget; // still committed
      } else {
        const curD = Math.hypot(this.x - this._lockedTarget.x, this.y - this._lockedTarget.y);
        if (bestD >= curD * 0.85) best = this._lockedTarget; // hysteresis
      }
    }
    if (best !== this._lockedTarget) {
      this._lockedTarget = (best && best.alive) ? best : null;
      this._lockTimer = lockDuration;
    }
    return this._lockedTarget;
  }
}

// ── Particles (visual effects for death/leaving) ─────────────────────
export class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x; this.y = y;
    this.vx = opts.vx || rand(-1, 1);
    this.vy = opts.vy || rand(-2, 0.5);
    this.color = color;
    this.life = opts.life || rand(20, 40);
    this.maxLife = this.life;
    this.size = opts.size || rand(1.5, 4);
    this.gravity = opts.gravity ?? 0.03;
    this.alive = true;
    this.type = opts.type || 'dot';
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
}