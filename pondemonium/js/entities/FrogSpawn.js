// ── Frog Spawn (Egg cluster) ────────────────────────────────────────
import { Entity } from '../entity.js';
import { randomGenotype, expressGenome, breedGenotype } from '../genome.js';
import { pond } from '../registry.js';
import { lerp, rand, randInt } from '../utils.js';
import { Tadpole } from './Tadpole.js';

export class FrogSpawn extends Entity {
  constructor(x, y, genome) {
    super(x, y);
    this.genome = genome || randomGenotype();
    this.radius = 6;
    const p = expressGenome(this.genome);
    this.incubation = lerp(15, 5, p.growthSpeed) * 60;
    this.hatchTimer = this.incubation;
    this.cluster = [];
    const n = randInt(3, 6);
    for (let i = 0; i < n; i++) {
      this.cluster.push({ ox: rand(-6, 6), oy: rand(-4, 4), r: rand(2.5, 4) });
    }
    this.bobPhase = rand(0, Math.PI * 2);
  }
  update(dt) {
    this.age += dt;
    if (this.age > 1800) { this.hatchTimer = 0; }
    this.hatchTimer -= dt;
    this.bobPhase += dt * 0.02;
    this.y += Math.sin(this.bobPhase) * 0.1;
    if (this.hatchTimer <= 0) {
      this.alive = false;
      const n = this.cluster.length;
      for (let i = 0; i < n; i++) {
        const tad = new Tadpole(
          this.x + rand(-8, 8), this.y + rand(-6, 6),
          breedGenotype(this.genome, this.genome, 0.05, 0.05)
        );
        pond.addTadpole(tad);
      }
    }
  }
}