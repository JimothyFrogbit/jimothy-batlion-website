// ── Food (Algae) ─────────────────────────────────────────────────────
import { Entity } from '../entity.js';
import { rand, lerp, clamp } from '../utils.js';
import { addToAlgaeGenePool, sampleAlgaeGenePool } from '../genome.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class Food extends Entity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || sampleAlgaeGenePool();
    const { POU1F1, IGF1, LEP, THR } = this.genome;
    this.radius = lerp(2, 8, clamp(POU1F1 * 0.4 + IGF1 * 0.4));
    this.nutrition = this.radius * 1.5;
    this.age = 0;
    this.maxAge = lerp(200, 900, clamp(LEP * 0.5 + THR * 0.2));
    this.vx = rand(-0.1, 0.1);
    this.vy = rand(-0.1, 0.1);
  }
  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < POND_X + this.radius) { this.x = POND_X + this.radius; this.vx *= -1; }
    if (this.x > POND_X + POND_W - this.radius) { this.x = POND_X + POND_W - this.radius; this.vx *= -1; }
    if (this.y < POND_Y + this.radius) { this.y = POND_Y + this.radius; this.vy *= -1; }
    if (this.y > POND_Y + POND_H - this.radius) { this.y = POND_Y + POND_H - this.radius; this.vy *= -1; }
    if (this.age > this.maxAge) { this.alive = false; addToAlgaeGenePool(this.genome); }
  }
}