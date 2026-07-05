// ── Main Entry Point (Phase 3 — ECS-driven) ─────────────────────────
import { Pond } from './pond.js';
import { setupUI, updateUI, loadSettings } from './ui.js';
import { ecsWorld } from './ecs/adapter.js';
import { syncEcsToPond } from './ecs-bridge.js';

const canvas = document.getElementById('pond');
const pond = new Pond(canvas);
const ui = setupUI();
loadSettings();

// ECS world is initialised inside Pond's constructor

const TICK_RATE = 1 / 60;
let lastTime = 0;

function gameLoop(time) {
  const rawDt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : TICK_RATE;
  lastTime = time;
  const steps = Math.ceil(rawDt / TICK_RATE);
  const subDt = rawDt / steps;

  for (let i = 0; i < steps; i++) {
    // ECS drives the simulation
    if (ecsWorld && !pond.paused) {
      const dt60 = subDt * 60 * pond.speed;
      ecsWorld.update(dt60);
      ecsWorld.reapDead();
    }
    // Pond handles seasons, stress events
    pond.update(subDt * 60);
  }

  // Sync ECS entities into pond rendering arrays for draw
  syncEcsToPond(pond, ecsWorld);

  pond.render();
  updateUI(ui);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
