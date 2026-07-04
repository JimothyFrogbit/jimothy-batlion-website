// ── Main Entry Point ────────────────────────────────────────────────
import { Pond } from './pond.js';
import { setupUI, updateUI, loadSettings } from './ui.js';

const canvas = document.getElementById('pond');
const pond = new Pond(canvas);
const ui = setupUI();
loadSettings();

const TICK_RATE = 1 / 60;
let lastTime = 0;

function gameLoop(time) {
  const rawDt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : TICK_RATE;
  lastTime = time;
  const steps = Math.ceil(rawDt / TICK_RATE);
  const subDt = rawDt / steps;
  for (let i = 0; i < steps; i++) {
    pond.update(subDt * 60);
  }
  pond.render();
  updateUI(ui);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);