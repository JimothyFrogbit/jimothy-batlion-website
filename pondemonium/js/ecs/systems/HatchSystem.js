// ── HatchSystem ─────────────────────────────────────────────────────
// Handles frogSpawn → tadpole and mosquitoEgg → mosquitoLarva hatching.
// Checks FrogSpawnTiming and EggSpawn components each tick.
// ECS Phase 3 system.

import { EcsSystem } from '../engine.js';
import { Position, Renderable, Species, Age, Growth, Animation,
         Stressable, DeathFx, Steering, TargetSeek,
         FrogSpawnTiming, EggSpawn } from '../components.js';
import { createTadpole } from '../factories.js';
import { rand, randInt } from '../../utils.js';
import { sampleGenePool, breedGenotype } from '../../genome.js';
import { MOSQUITO_LARVA_GROWTH_RATE } from '../balance.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

export class HatchSystem extends EcsSystem {
  constructor() {
    super('HatchSystem');
  }

  update(dt, world) {
    // ── Hatch frog spawn → tadpoles ──
    const spawns = world.queryData('Position', 'Species', 'FrogSpawnTiming', 'Age');
    for (const t of spawns) {
      if (t.Species.type !== 'frogSpawn') continue;
      const timing = t.FrogSpawnTiming;
      timing.hatchTimer -= dt;

      if (timing.hatchTimer <= 0) {
        const pos = t.Position;
        const gen = world.getComponent(t.entityId, 'Genome');
        const parentGenotype = gen ? gen.genotype : sampleGenePool();

        // Mark spawn as dead
        world.markDead(t.entityId);

        // Spawn tadpoles (3-6 per cluster). Matches legacy FrogSpawn.update():
        // each sibling is a self-bred (low mutation) variant of the clutch
        // genome, not an identical clone — small sibling-to-sibling variation.
        const count = timing.clusterCount || randInt(3, 6);
        for (let i = 0; i < count; i++) {
          const ox = rand(-8, 8);
          const oy = rand(-6, 6);
          const genotype = breedGenotype(parentGenotype, parentGenotype, 0.05, 0.05);
          createTadpole(world, pos.x + ox, pos.y + oy, genotype);
        }
      }
    }

    // ── Hatch mosquito eggs → mosquito larvae ──
    const eggs = world.queryData('Position', 'Species', 'EggSpawn', 'Age');
    for (const t of eggs) {
      if (t.Species.type !== 'mosquitoEgg') continue;
      const eggSpawn = t.EggSpawn;
      const pos = t.Position;

      // Increment timer
      eggSpawn.timer += dt;

      // Drift horizontally
      pos.x += eggSpawn.driftX * dt;
      if (pos.x < POND_X + 5) { pos.x = POND_X + 5; eggSpawn.driftX *= -1; }
      if (pos.x > POND_X + POND_W - 5) { pos.x = POND_X + POND_W - 5; eggSpawn.driftX *= -1; }

      // Hatch when incubation is complete
      if (eggSpawn.timer >= eggSpawn.incubation) {
        world.markDead(t.entityId);

        const count = eggSpawn.eggCount || randInt(8, 18);
        for (let i = 0; i < count; i++) {
          const ox = rand(-8, 8);
          const oy = rand(-4, 4);
          world.createEntity({
            Position: Position(pos.x + ox, pos.y + oy),
            Renderable: Renderable(3, null, 1),
            Species: Species('mosquitoLarva'),
            Age: Age(Infinity),
            // Rate + rationale live in balance.js (MOSQUITO_LARVA_GROWTH_RATE) —
            // mosquitoes deliberately mature faster than tadpoles, scaled by
            // the same MATURATION_SLOWDOWN dial as everything else.
            Growth: Growth(0, 5, rand(...MOSQUITO_LARVA_GROWTH_RATE)),
            Animation: Animation(),
            // Weak swimmers — real mosquito "wrigglers" mostly hang near the
            // surface and don't cover much ground, but they do drift, unlike
            // the old wiggle-in-place-only motion (pure sin/cos oscillation
            // with no net displacement — see AnimationSystem's mosquitoLarva
            // case, which still handles the small per-frame wiggle/rotation;
            // this is what makes them actually go somewhere over time).
            Steering: Steering(rand(0.1, 0.25), 0.6, 0),
            TargetSeek: TargetSeek(),
            Stressable: Stressable(0.3),
            DeathFx: DeathFx(false),
          });
        }
      }
    }
  }
}
