// ── Canvas Renderer ────────────────────────────────────────────────
// Renders all visible entities to a canvas each frame.
// Critters are coloured by their emergent species label or genome hue.
//
// Phase 3: Predator visual indicator — critters with aggression > 0.6
// get a subtle dark ring. Critters that just ate (eatCooldown > 0) get
// a slight glow.

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  render(world) {
    const ctx = this.ctx;
    const [posStore, renStore, foodStore, ccStore, mouthStore] =
      world.getStores('Position', 'Renderable', 'FoodSource', 'CritterConfig', 'Mouth');

    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid lines for visual reference
    ctx.strokeStyle = '#2a3a2a';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    if (!posStore || !renStore) return;

    // Draw food sources first (behind critters)
    if (foodStore) {
      for (const [eid, food] of foodStore.getAll()) {
        if (!world.hasEntity(eid)) continue;
        const pos = posStore.get(eid);
        const ren = renStore.get(eid);
        if (!pos || !ren) continue;
        ctx.globalAlpha = ren.alpha || 1;
        ctx.fillStyle = ren.color || '#44bb44';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ren.radius || 6, 0, Math.PI * 2);
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = '#66dd66';
        ctx.beginPath();
        ctx.arc(pos.x - 2, pos.y - 2, (ren.radius || 6) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw critters
    for (const [eid, pos] of posStore.getAll()) {
      if (!world.hasEntity(eid)) continue;
      const ren = renStore.get(eid);
      if (!ren) continue;
      const food = foodStore ? foodStore.get(eid) : null;
      if (food) continue; // skip food — already drawn

      const cc = ccStore ? ccStore.get(eid) : null;
      const mouth = mouthStore ? mouthStore.get(eid) : null;
      const r = ren.radius || 4;
      const isAggressive = cc && cc.aggression > 0.6;
      const justAte = mouth && mouth.eatCooldown > 0;

      // ── Phase 3: Predator visual indicators ─────────────────────

      // Glow effect for critters that just ate
      if (justAte) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#ff5533';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Predator ring — dark border for very aggressive critters
      if (isAggressive) {
        ctx.strokeStyle = '#442211';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main body
      ctx.globalAlpha = ren.alpha || 1;
      ctx.fillStyle = ren.color || '#88cc44';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator (a small dot in front)
      const len = Math.hypot(pos.vx, pos.vy);
      if (len > 0.1) {
        const tx = pos.x + (pos.vx / len) * (r + 3);
        const ty = pos.y + (pos.vy / len) * (r + 3);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  /** Draw a text overlay on the simulation. */
  drawOverlay(text, x = 10, y = 20) {
    const ctx = this.ctx;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#aaccaa';
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
  }
}
