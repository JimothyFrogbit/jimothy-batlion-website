// ── Dragonfly Nymph (submerged predator) ────────────────────────────
import { MovingEntity, Particle } from '../entity.js';
import { pond } from '../registry.js';
import { rand, lerp, clamp } from '../utils.js';
import { sampleDragonflyGenePool } from '../genome.js';
import { DragonflyAdult } from './DragonflyAdult.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class DragonflyNymph extends MovingEntity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || sampleDragonflyGenePool();
    const { POU1F1, THR, MC1R, IGF1, LEP } = this.genome;
    this.radius = 9;
    this.growth = 0;
    this.satiation = 100;
    this.energy = 100;
    this.phase = rand(0, Math.PI * 2);
    this.wobble = rand(0, 1000);
    this.targetDir = rand(0, Math.PI * 2);
    this.targetTimer = 0;
    this._speed = lerp(0.5, 1.6, clamp(THR * 0.5 + MC1R * 0.3));
    this._sight = lerp(50, 180, clamp(MC1R * 0.5 + POU1F1 * 0.3));
    this._attackCooldown = lerp(10, 40, clamp(LEP * 0.4 + (1 - THR) * 0.3));
    this._meals = 0;
    this._agility = lerp(1.0, 0.4, this.radius / 12);
  }
  update(dt) {
    this.age += dt;
    this.phase += dt * 0.02;
    this.wobble += dt * 0.04;
    this._attackCooldown -= dt;
    this.satiation -= 0.02 * dt;
    if (this.satiation < 0) { this.energy -= 0.03 * dt; this.satiation = 0; }
    this.targetTimer -= dt;
    // Hunt tadpoles first (preferred prey), then mosquito larvae
    const prey = this.selectTarget(pond.tadpoles.concat(pond.mosquitoLarvae), this._sight, 60, (p) => p.alive);
    if (prey && Math.hypot(this.x - prey.x, this.y - prey.y) < this._sight) {
      const d = Math.hypot(this.x - prey.x, this.y - prey.y);
      if (d > this.radius + prey.radius + 3) {
        this.steerToward(prey.x, prey.y, dt);
      }
    } else {
      if (this.targetTimer <= 0) { this.targetDir = rand(0, Math.PI * 2); this.targetTimer = rand(60, 200); }
      this.vx += Math.cos(this.targetDir) * 0.03 * this._agility * dt;
      this.vy += Math.sin(this.targetDir) * 0.03 * this._agility * dt;
    }
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this._speed) { this.vx = (this.vx / spd) * this._speed; this.vy = (this.vy / spd) * this._speed; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.95; this.vy *= 0.95;
    const r = this.radius;
    if (this.x < POND_X + r) { this.x = POND_X + r; this.vx *= -0.5; }
    if (this.x > POND_X + POND_W - r) { this.x = POND_X + POND_W - r; this.vx *= -0.5; }
    if (this.y < POND_Y + r) { this.y = POND_Y + r; this.vy *= -0.5; }
    if (this.y > POND_Y + POND_H - r) { this.y = POND_Y + POND_H - r; this.vy *= -0.5; }
    if (this.energy <= 0) {
      if (!this._spawnedDeathFx) {
        this._spawnedDeathFx = true;
        for (let i = 0; i < 4; i++) pond.particles.push(new Particle(this.x, this.y, 'hsla(160, 50%, 30%, 0.4)', { vy: rand(0.1, 0.4), life: rand(15, 30), size: rand(1, 2), gravity: 0.01 }));
      }
      if (pond.activeEvent) pond.recordStressDeath();
      this.alive = false; return;
    }
    if (this.growth >= 1 && this.age > 500) {
      this.alive = false;
      pond.addDragonfly(new DragonflyAdult(this.x, this.y, this.genome));
      for (let i = 0; i < 6; i++) pond.particles.push(new Particle(this.x, this.y, 'hsla(170, 60%, 45%, 0.6)', { vx: rand(-2, 2), vy: rand(-3, 0.5), life: rand(20, 40), size: rand(2, 4), gravity: 0.03 }));
    }
  }
}