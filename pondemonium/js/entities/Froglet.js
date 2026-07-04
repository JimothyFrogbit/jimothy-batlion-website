// ── Froglet (metamorphosed tadpole) ─────────────────────────────────
import { MovingEntity, Particle } from '../entity.js';
import { randomGenotype, expressGenome, addToGenePool } from '../genome.js';
import { pond } from '../registry.js';
import { lerp, rand } from '../utils.js';
import { Food } from './Food.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class Froglet extends MovingEntity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || randomGenotype();
    this.phenotype = expressGenome(this.genome);
    this.radius = 10;
    this.growth = 0.85;
    this.energy = 100;
    this.satiation = 80;
    this.legLength = 8;
    this.phase = rand(0, Math.PI * 2);
    this.targetDir = rand(0, Math.PI * 2);
    this.targetTimer = 0;
    this.jumpCooldown = 0;
    this._speed = lerp(0.3, 1.8, this.phenotype.swimSpeed);
    this._sight = lerp(40, 160, this.phenotype.sightRange);
    this._metabolism = lerp(0.2, 1.2, this.phenotype.metabolism);
    this._mouth = lerp(3, 10, this.phenotype.mouthGape);
    this._maxSize = lerp(12, 24, this.phenotype.bodySize);
    this._growthRate = lerp(0.0008, 0.003, this.phenotype.growthSpeed);
    this._jumpDrive = lerp(0.3, 1.5, this.phenotype.growthSpeed * 0.7 + this.phenotype.bodySize * 0.3);
    this._agility = lerp(1.0, 0.15, this.phenotype.bodySize);
  }
  update(dt) {
    this.age += dt;
    this.jumpCooldown -= dt;
    this.satiation -= this._metabolism * 0.16 * dt;
    if (this.satiation < 0) { this.energy -= lerp(0.08, 0.30, this.phenotype.metabolism) * dt; this.satiation = 0; }
    this.growth += this._growthRate * dt * (this.satiation > 50 ? 1 : 0.3);
    this.radius = lerp(10, this._maxSize, this.growth);
    this.legLength = lerp(8, 16, this.growth);
    this._agility = lerp(1.0, 0.15, (this.radius - 10) / (this._maxSize - 10 + 0.01));
    this.targetTimer -= dt;
    const nearestFood = this.selectTarget(pond.food, this._sight, 45, (f) => f.radius <= this._mouth + 2);
    const nearestMosquito = this.selectTarget(pond.mosquitoes, this._sight * 0.8, 30);
    let target = null;
    if (nearestMosquito) { target = nearestMosquito; }
    else if (nearestFood) { target = nearestFood; }
    if (target) {
      this.steerToward(target.x, target.y, dt);
    } else {
      if (this.targetTimer <= 0) { this.targetDir = rand(0, Math.PI * 2); this.targetTimer = rand(30, 120); }
      this.vx += Math.cos(this.targetDir) * 0.04 * this._agility * dt;
      this.vy += Math.sin(this.targetDir) * 0.04 * this._agility * dt;
    }
    if (this.jumpCooldown <= 0 && Math.random() < 0.005 * dt) {
      const angle = rand(0, Math.PI * 2);
      this.vx += Math.cos(angle) * rand(2, 5);
      this.vy += Math.sin(angle) * rand(2, 5);
      this.jumpCooldown = rand(20, 60);
    }
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this._speed + 3) {
      this.vx = (this.vx / spd) * (this._speed + 3);
      this.vy = (this.vy / spd) * (this._speed + 3);
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.94; this.vy *= 0.94;
    if (this.x < POND_X + this.radius) { this.x = POND_X + this.radius; this.vx *= -0.5; }
    if (this.x > POND_X + POND_W - this.radius) { this.x = POND_X + POND_W - this.radius; this.vx *= -0.5; }
    if (this.y < POND_Y + this.radius) { this.y = POND_Y + this.radius; this.vy *= -0.5; }
    if (this.y > POND_Y + POND_H - this.radius) { this.y = POND_Y + POND_H - this.radius; this.vy *= -0.5; }
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
    if (this.growth >= 1 && this.satiation > 60 && this.age > 600) {
      if (Math.random() < 0.002 * dt * this._jumpDrive) {
        this.alive = false;
        pond.frogsReleased++;
        addToGenePool(this.genome);
        pond.generation++;
        for (let i = 0; i < 8; i++) {
          pond.particles.push(new Particle(this.x, this.y, 'hsla(140, 70%, 60%, 0.7)',
            { vx: rand(-2, 2), vy: rand(-3, 0.5), life: rand(20, 45), size: rand(2, 5), gravity: 0.04 }));
        }
        for (let i = 0; i < 3; i++) {
          pond.addFood(new Food(this.x + rand(-10, 10), this.y + rand(-10, 10)));
        }
      }
    }
  }
}