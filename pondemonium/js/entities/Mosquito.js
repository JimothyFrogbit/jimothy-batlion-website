// ── Adult Mosquito ───────────────────────────────────────────────────
import { Entity } from '../entity.js';
import { pond } from '../registry.js';
import { rand, randInt, lerp, clamp } from '../utils.js';
import { addToMosquitoGenePool, sampleMosquitoGenePool } from '../genome.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class Mosquito extends Entity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || sampleMosquitoGenePool();
    const { POU1F1, THR, MC1R, IGF1, LEP } = this.genome;
    this.radius = 3;
    this.life = lerp(100, 700, clamp(LEP * 0.6 + IGF1 * 0.2));
    this.age = 0;
    this.phase = rand(0, Math.PI * 2);
    this.flightY = y;
    this.altitude = lerp(-30, -5, clamp(MC1R * 0.5 + THR * 0.3));
    this._speed = lerp(0.3, 2.0, clamp(POU1F1 * 0.5 + THR * 0.3));
    this._agility = lerp(1.0, 0.5, this.radius / 8);
  }
  update(dt) {
    this.age += dt;
    this.phase += dt * 0.04;
    this.vx += rand(-1, 1) * 0.1 * this._agility * dt;
    this.vy += rand(-1, 1) * 0.1 * this._agility * dt;
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this._speed) { this.vx = (this.vx / spd) * this._speed; this.vy = (this.vy / spd) * this._speed; }
    this.x += this.vx * dt;
    this.flightY += this.vy * dt;
    this.y = this.flightY + this.altitude;
    this.vx *= 0.97; this.vy *= 0.97;
    if (this.x < POND_X + 5) { this.x = POND_X + 5; this.vx *= -1; }
    if (this.x > POND_X + POND_W - 5) { this.x = POND_X + POND_W - 5; this.vx *= -1; }
    if (this.flightY < POND_Y - 30) { this.flightY = POND_Y - 30; this.vy *= -1; }
    if (this.flightY > POND_Y + POND_H + 30) { this.flightY = POND_Y + POND_H + 30; this.vy *= -1; }
    if (this.age > this.life) {
      this.alive = false;
      pond.mosquitoesReleased++;
      pond.humansBitten += randInt(2, 8);
      addToMosquitoGenePool(this.genome);
    }
  }
}