// ── Mosquito Larva (Wriggler) ────────────────────────────────────────
import { Entity } from '../entity.js';
import { pond } from '../registry.js';
import { rand } from '../utils.js';
import { Mosquito } from './Mosquito.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class MosquitoLarva extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 3;
    this.growth = 0;
    this.phase = rand(0, Math.PI * 2);
    this.wiggleX = 0;
    this._growthRate = rand(0.002, 0.006);
  }
  update(dt) {
    this.age += dt;
    this.phase += dt * 0.08;
    this.growth += this._growthRate * dt;
    this.radius = lerp(2, 5, this.growth);
    this.wiggleX = Math.sin(this.phase) * 2;
    this.y += Math.sin(this.phase * 2) * 0.2 * dt;
    this.x += Math.cos(this.phase * 0.7) * 0.1 * dt;
    if (this.x < POND_X + 3) this.x = POND_X + 3;
    if (this.x > POND_X + POND_W - 3) this.x = POND_X + POND_W - 3;
    if (this.y < POND_Y + 3) this.y = POND_Y + 3;
    if (this.y > POND_Y + POND_H - 3) this.y = POND_Y + POND_H - 3;
    if (this.growth >= 1) {
      this.alive = false;
      pond.addMosquito(new Mosquito(this.x + rand(-5, 5), this.y - rand(5, 15)));
    }
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }