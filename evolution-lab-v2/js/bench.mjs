// ── Quick benchmark: raw tick speed of Evolution Lab v2 ─────────
import { EcsWorld } from './ecs/engine.js';
import { registerAllComponents } from './ecs/components.js';
import { registerAllSystems } from './ecs/systems.js';
import { spawnCritter, spawnFood } from './ecs/factories.js';
import { clusterSpecies } from './species.js';

const W = 800, H = 600;

const world = new EcsWorld();
registerAllComponents(world);
registerAllSystems(world);

for (let i = 0; i < 30; i++) spawnCritter(world, Math.random() * W, Math.random() * H);
for (let i = 0; i < 40; i++) spawnFood(world, Math.random() * W, Math.random() * H);

const dt = 1/60;
const tickTargets = [1000, 5000, 10000, 50000];

for (const target of tickTargets) {
  const t0 = performance.now();
  let tickCount = 0;
  for (let i = 0; i < target; i++) {
    world.update(dt);
    world.reapDead();
    tickCount++;
    if (tickCount % 120 === 0 && world.count('FoodSource') < 60) {
      spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
    }
  }
  const elapsed = (performance.now() - t0) / 1000;
  const perTick = (elapsed / target * 1000).toFixed(2);
  console.log(`  ${target} ticks: ${elapsed.toFixed(2)}s (${perTick}ms/tick, ${(target/elapsed/1000).toFixed(1)}K ticks/sec)`);
  console.log(`    Population: ${world.activeEntityCount}`);
}
