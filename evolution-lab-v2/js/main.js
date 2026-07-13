// ── Evolution Lab v2 — Main ─────────────────────────────────────────
// Game loop: initialises the ECS world, spawns critters and food,
// runs systems per tick, and renders the result.

import { EcsWorld } from './ecs/engine.js';
import { registerAllComponents } from './ecs/components.js';
import { registerAllSystems } from './ecs/systems.js';
import { spawnCritter, spawnFood } from './ecs/factories.js';
import { resetPool } from './genome.js';
import { Renderer } from './ui/renderer.js';
import { ControlsUI } from './ui/controls.js';
import { registerSimState } from './registry.js';
import { clusterSpecies, countSpecies, resetClustering } from './species.js';

const W = 800, H = 600;

// ── Initialisation ─────────────────────────────────────────────────

function createWorld() {
  const world = new EcsWorld();
  registerAllComponents(world);
  registerAllSystems(world);
  return world;
}

function populateWorld(world, critterCount = 30, foodCount = 40) {
  for (let i = 0; i < critterCount; i++) {
    spawnCritter(world, Math.random() * W, Math.random() * H);
  }
  for (let i = 0; i < foodCount; i++) {
    spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
  }
}

// ── Main ───────────────────────────────────────────────────────────

const simState = {
  world: null,
  generation: 0,
  speed: 1,
  running: false,
  renderer: null,
  controls: null,
  speciesCount: 0,
  _lastTick: 0,
  _accumulator: 0,
  _tickRate: 1 / 60,
};

registerSimState(simState);

export function init(canvasId = 'sim-canvas', controlsId = 'sim-controls') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error('Sim canvas not found:', canvasId);
    return;
  }
  canvas.width = W;
  canvas.height = H;

  const controlsContainer = document.getElementById(controlsId) || document.body;

  simState.renderer = new Renderer(canvas);
  simState.controls = new ControlsUI(controlsContainer, {
    onSpeedChange: (s) => { simState.speed = s; },
    onPauseToggle: () => {
      simState.running = !simState.running;
      simState.controls.setPaused(!simState.running);
      if (simState.running) {
        simState._lastTick = performance.now();
        requestAnimationFrame(gameLoop);
      }
    },
    onSpawnCritter: () => {
      if (simState.world) {
        spawnCritter(simState.world, Math.random() * W, Math.random() * H);
      }
    },
    onReset: () => {
      resetSim();
    },
  });

  resetSim();
  simState.running = true;
  simState._lastTick = performance.now();
  requestAnimationFrame(gameLoop);
}

function resetSim() {
  simState.world = createWorld();
  populateWorld(simState.world, 30, 40);
  simState.generation = 0;
  simState.speciesCount = 0;
  resetPool();
  resetClustering();
}

let _tickCount = 0;

function gameLoop(timestamp) {
  if (!simState.running) return;

  const dt = Math.min((timestamp - simState._lastTick) / 1000, 0.05); // cap at 50ms
  simState._lastTick = timestamp;

  simState._accumulator += dt * simState.speed;

  // Fixed timestep updates
  while (simState._accumulator >= simState._tickRate) {
    const tickDt = simState._tickRate;
    tick(simState.world, tickDt);
    simState._accumulator -= simState._tickRate;
    _tickCount++;
  }

  // Render
  simState.renderer.render(simState.world);

  // Update overlays
  const pop = simState.world.activeEntityCount;
  const gen = simState.generation;
  const food = simState.world.count('FoodSource');
  const species = simState.speciesCount;
  simState.controls.updateStats(pop, gen, food, species);

  simState.renderer.drawOverlay(
    `Pop: ${pop}  Gen: ${gen}  Sp: ${species}  Food: ${food}  Speed: ${simState.speed}x`
  );

  requestAnimationFrame(gameLoop);
}

function tick(world, dt) {
  // Run all ECS systems
  world.update(dt);

  // Reap dead entities
  const reaped = world.reapDead();

  // Species clustering (runs every ~200 ticks internally)
  const speciesResult = clusterSpecies(world, _tickCount);
  simState.speciesCount = countSpecies(world);

  // Update species legend if clustering ran this tick
  if (speciesResult && speciesResult.species) {
    simState.controls.updateSpecies(speciesResult.species);
  }

  // Respawn food periodically
  if (_tickCount % 120 === 0 && world.count('FoodSource') < 60) {
    spawnFood(world, Math.random() * W, Math.random() * H, 5 + Math.random() * 6);
  }

  // Track generations (every 500 ticks = ~8 sec at 1x)
  if (_tickCount % 500 === 0) {
    simState.generation++;
  }

  // Auto-spawn new critters if population is low
  const pop = world.activeEntityCount;
  if (pop < 10 && _tickCount % 60 === 0) {
    for (let i = 0; i < 3; i++) {
      spawnCritter(world, Math.random() * W, Math.random() * H);
    }
  }
}
