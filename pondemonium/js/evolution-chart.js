// ── Evolution Trend Chart ─────────────────────────────────────────────
// Draws in-simulation line chart of average gene values over generations.
// Imported by ui.js, rendered every frame on a dedicated canvas.

const GENE_COLORS = {
  POU1F1: '#ff6b6b',
  THR:    '#ffd93d',
  MC1R:   '#6bcb77',
  IGF1:   '#4d96ff',
  LEP:    '#ff8fab',
  NR3C1:  '#c77dff',
};

const GENE_ORDER = ['POU1F1', 'THR', 'MC1R', 'IGF1', 'LEP', 'NR3C1'];

const PAD_LEFT = 36;
const PAD_RIGHT = 4;
const PAD_TOP = 8;
const PAD_BOT = 20;
const MAX_POINTS = 100;  // last N generations shown

export function drawEvoChart(canvas, generationData) {
  if (!canvas || !generationData || generationData.length < 2) {
    // Draw placeholder
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3a5a4a';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for data…', canvas.width / 2, canvas.height / 2 + 3);
    return;
  }

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Background
  ctx.fillStyle = '#1a1a30';
  ctx.fillRect(0, 0, W, H);

  // Thin border
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, W, H);

  // Plot area
  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOT;

  // Subgrid background
  ctx.fillStyle = '#14142a';
  ctx.fillRect(plotX, plotY, plotW, plotH);

  // Slice the last MAX_POINTS
  const data = generationData.slice(-MAX_POINTS);
  const n = data.length;

  // Determine y-range across all genes
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const row of data) {
    for (const k of GENE_ORDER) {
      const v = row[k];
      if (v !== undefined && !isNaN(v)) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 1;
  // Add padding
  const range = yMax - yMin || 0.1;
  yMin -= range * 0.1;
  yMax += range * 0.1;

  // ── Grid lines ──
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 0.5;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = plotY + (plotH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();

    // Y-axis label
    const val = yMax - (range * i) / gridLines;
    ctx.fillStyle = '#5a7a6a';
    ctx.font = '8px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val.toFixed(2), plotX - 4, y);
  }

  // ── X-axis labels ──
  ctx.fillStyle = '#5a7a6a';
  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const firstGen = data[0].generation;
  const lastGen = data[n - 1].generation;
  ctx.fillText(String(firstGen), plotX, plotY + plotH + 4);
  ctx.fillText(String(lastGen), plotX + plotW, plotY + plotH + 4);
  if (n > 2) {
    const midIdx = Math.floor(n / 2);
    const midGen = data[midIdx].generation;
    ctx.fillText(String(midGen), plotX + (plotW * midIdx) / (n - 1), plotY + plotH + 4);
  }

  // X-axis label
  ctx.fillStyle = '#4a6a5a';
  ctx.font = '7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('generation', plotX + plotW / 2, plotY + plotH + 4);

  // ── Draw each gene line ──
  for (const k of GENE_ORDER) {
    if (!GENE_COLORS[k]) continue;
    const color = GENE_COLORS[k];

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < n; i++) {
      const v = data[i][k];
      if (v === undefined || isNaN(v)) continue;
      const x = plotX + (plotW * i) / (n - 1);
      const y = plotY + plotH - ((v - yMin) / range) * plotH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    if (started) {
      ctx.stroke();
    }
  }

  // ── Legend ──
  const legendY = plotY + 2;
  let legendX = plotX + 4;
  for (const k of GENE_ORDER) {
    if (!GENE_COLORS[k]) continue;
    const color = GENE_COLORS[k];
    // Swatch
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY, 6, 6);
    // Label
    ctx.fillStyle = '#7a9a8a';
    ctx.font = '7px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(k, legendX + 8, legendY);
    legendX += 8 + ctx.measureText(k).width + 8;
    if (legendX > plotX + plotW - 20) break; // wrap safety
  }
}