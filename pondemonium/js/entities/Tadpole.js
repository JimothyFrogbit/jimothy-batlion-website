// ── Tadpole ──────────────────────────────────────────────────────────
import { MovingEntity, Particle } from '../entity.js';
import { randomGenotype, expressGenome } from '../genome.js';
import { pond } from '../registry.js';
import { lerp, rand } from '../utils.js';
import { Froglet } from './Froglet.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class Tadpole extends MovingEntity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || randomGenotype();
    this.phenotype = expressGenome(this.genome);
    this.radius = 4;
    this.growth = 0;
    this.energy = 100;
    this.maxEnergy = 100;
    this.tailLength = 14;
    this.satiation = 100;
    this.phase = rand(0, Math.PI * 2);
    this.wobble = rand(0, 1000);
    this.targetDir = rand(0, Math.PI * 2);
    this.targetTimer = 0;
    this._speed = lerp(0.3, 1.8, this.phenotype.swimSpeed);
    this._sight = lerp(30, 120, this.phenotype.sightRange);
    this._metabolism = lerp(0.3, 1.5, this.phenotype.metabolism);
    this._mouth = lerp(1, 5, this.phenotype.mouthGape);
    this._maxSize = lerp(6, 16, this.phenotype.bodySize);
    this._growthRate = lerp(0.0013, 0.0043, this.phenotype.growthSpeed);
    this._agility = lerp(1.0, 0.15, this.phenotype.bodySize); // big = sluggish turning
  }
  update(dt) {
    this.age += dt;
    this.wobble += dt * 0.05;
    this.satiation -= this._metabolism * 0.20 * dt;
    if (this.satiation < 0) { this.energy -= lerp(0.10, 0.35, this.phenotype.metabolism) * dt; this.satiation = 0; }
    this.growth += this._growthRate * dt * (this.satiation > 50 ? 1 : 0.3);
    this.radius = lerp(4, this._maxSize, this.growth);
    this.tailLength = lerp(14, 4, this.growth * 1.2);
    // Recalc agility as tadpole grows
    this._agility = lerp(1.0, 0.15, (this.radius - 4) / (this._maxSize - 4 + 0.01));
    this.targetTimer -= dt;
    const nearest = this.selectTarget(pond.food, this._sight, 45, (f) => f.radius <= this._mouth + 1);
    if (nearest) {
      this.steerToward(nearest.x, nearest.y, dt);
    } else {
      if (this.targetTimer <= 0) { this.targetDir = rand(0, Math.PI * 2); this.targetTimer = rand(30, 120); }
      this.vx += Math.cos(this.targetDir) * 0.05 * dt;
      this.vy += Math.sin(this.targetDir) * 0.05 * dt;
    }
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this._speed) { this.vx = (this.vx / spd) * this._speed; this.vy = (this.vy / spd) * this._speed; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.96; this.vy *= 0.96;
    const r = this.radius;
    if (this.x < POND_X + r) { this.x = POND_X + r; this.vx *= -0.5; }
    if (this.x > POND_X + POND_W - r) { this.x = POND_X + POND_W - r; this.vx *= -0.5; }
    if (this.y < POND_Y + r) { this.y = POND_Y + r; this.vy *= -0.5; }
    if (this.y > POND_Y + POND_H - r) { this.y = POND_Y + POND_H - r; this.vy *= -0.5; }
    this.phase += dt * 0.03;
    if (this.energy <= 0) {
      if (!this._spawnedDeathFx) {
        this._spawnedDeathFx = true;
        for (let i = 0; i < 5; i++) {
          pond.particles.push(new Particle(this.x, this.y, 'hsla(30, 40%, 25%, 0.5)',
            { vy: rand(0.1, 0.5), life: rand(15, 30), size: rand(1, 2.5), gravity: 0.01 }));
        }
      }
      if (pond.activeEvent) pond.recordStressDeath();
      this.alive = false; return;
    }
    if (this.growth >= 1) {
      this.alive = false;
      const froglet = new Froglet(this.x, this.y, this.genome);
      pond.addFroglet(froglet);
    }
  }
}