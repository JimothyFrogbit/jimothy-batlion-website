// ── Dragonfly Adult (flying) ────────────────────────────────────────
import { Entity } from '../entity.js';
import { pond } from '../registry.js';
import { rand, lerp, clamp } from '../utils.js';
import { addToDragonflyGenePool } from '../genome.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class DragonflyAdult extends Entity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || null;
    const g = this.genome || {};
    const { POU1F1, THR, MC1R, IGF1, LEP } = g;
    this.radius = 7;
    this.life = lerp(100, 500, clamp((LEP || 0.5) * 0.5 + (IGF1 || 0.5) * 0.3));
    this.age = 0;
    this.phase = rand(0, Math.PI * 2);
    this.flightY = y;
    this.altitude = rand(-40, -15);
    this._speed = lerp(0.8, 3.0, clamp((THR || 0.5) * 0.5 + (MC1R || 0.5) * 0.3));
    this._wingAngle = 0;
    this._agility = lerp(1.0, 0.5, this.radius / 10);
  }
  update(dt) {
    this.age += dt;
    this.phase += dt * 0.06;
    this._wingAngle += dt * 0.15;
    this.vx += rand(-1, 1) * 0.2 * this._agility * dt;
    this.vy += rand(-1, 1) * 0.2 * this._agility * dt;
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this._speed) { this.vx = (this.vx / spd) * this._speed; this.vy = (this.vy / spd) * this._speed; }
    this.x += this.vx * dt;
    this.flightY += this.vy * dt;
    this.y = this.flightY + this.altitude;
    this.vx *= 0.97; this.vy *= 0.97;
    if (this.x < POND_X - 20) { this.x = POND_X - 20; this.vx *= -1; }
    if (this.x > POND_X + POND_W + 20) { this.x = POND_X + POND_W + 20; this.vx *= -1; }
    if (this.flightY < POND_Y - 60) { this.flightY = POND_Y - 60; this.vy *= -1; }
    if (this.flightY > POND_Y + POND_H + 40) { this.flightY = POND_Y + POND_H + 40; this.vy *= -1; }
    if (this.age > this.life) {
      this.alive = false;
      pond.dragonfliesReleased++;
      if (this.genome) addToDragonflyGenePool(this.genome);
    }
  }
}