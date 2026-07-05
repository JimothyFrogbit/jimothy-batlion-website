// ── HatchSystem ─────────────────────────────────────────────────────
// Handles frogSpawn → tadpole and mosquitoEgg → mosquitoLarva hatching.
// Checks FrogSpawnTiming and EggSpawn components each tick.
// ECS Phase 3 system.

import { EcsSystem } from '../engine.js';
import { Position, Renderable, Species, Age, Genome, Growth, Energy, Mouth,
         Steering, TargetSeek, Animation, Stressable, DeathFx, EdgeSpawn,
         FrogSpawnTiming } from '../components.js';
import { rand, randInt, lerp } from '../../utils.js';
import { sampleGenePool } from '../../genome.js';

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
        const genotype = gen ? gen.genotype : sampleGenePool();
        const eid = world.getComponent(t.entityId, 'EdgeSpawn');

        // Mark spawn as dead
        world.markDead(t.entityId);

        // Spawn tadpoles (3-6 per cluster)
        const count = timing.clusterCount || randInt(3, 6);
        for (let i = 0; i < count; i++) {
          const ox = rand(-8, 8);
          const oy = rand(-6, 6);
          const tadId = world.createEntity({
            Position: Position(pos.x + ox, pos.y + oy),
            Renderable: Renderable(4, null, 1),
            Species: Species('tadpole'),
            Age: Age(Infinity),
            Genome: { genotype: { ...genotype }, phenotype: null },
            Growth: Growth(0, lerp(6, 16, genotype.bodySize || 0.5), lerp(0.0013, 0.0043, genotype.growthSpeed || 0.5)),
            Energy: Energy(100, 100),
            Mouth: Mouth(lerp(1, 5, genotype.mouthGape || 0.5), 'algae'),
            Steering: Steering(lerp(0.3, 1.8, genotype.swimSpeed || 0.5), lerp(1.0, 0.15, genotype.bodySize || 0.5), lerp(30, 120, genotype.sightRange || 0.5)),
            TargetSeek: TargetSeek(),
            Animation: Animation(),
            Stressable: Stressable(genotype.stressResilience || 0.3),
            DeathFx: DeathFx(false),
          });
        }
      }
    }
  }
}
