// ── Mosquito Egg Raft ────────────────────────────────────────────────
import { Entity } from '../entity.js';
import { pond } from '../registry.js';
import { rand, randInt } from '../utils.js';
import { MosquitoLarva } from './MosquitoLarva.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class MosquitoEggRaft extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 5;
    this.eggCount = randInt(8, 18);
    this.incubation = rand(120, 300);
    this.timer = 0;
    this.driftX = rand(-0.05, 0.05);
  }
  update(dt) {
    this.age += dt;
    this.timer += dt;
    this.x += this.driftX * dt;
    if (this.x < POND_X + 5) { this.x = POND_X + 5; this.driftX *= -1; }
    if (this.x > POND_X + POND_W - 5) { this.x = POND_X + POND_W - 5; this.driftX *= -1; }
    if (this.timer >= this.incubation) {
      this.alive = false;
      for (let i = 0; i < this.eggCount; i++) {
        pond.addMosquitoLarva(new MosquitoLarva(this.x + rand(-8, 8), this.y + rand(-4, 4)));
      }
    }
  }
}