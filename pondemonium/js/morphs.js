// ── Colour Morphs & Speciation ──────────────────────────────────────
// Detects when the frog gene pool diverges into distinct clusters and
// assigns each cluster a recognisable colour morph.
//
// Speciation happens when different selection pressures push sub-populations
// in different directions — e.g., high-metabolism fast growers vs low-metabolism
// stress-resilient survivors. Each morph has a distinct visual colour so
// you can SEE the divergence happening in real-time.
//
// Imported by: pond.js (rendering + lineage tracking), ui.js (morph display)

import { REGULATORY_GENES } from './genome.js';

// ── Morph Definitions ───────────────────────────────────────────────
// Each morph defines:
//   - id / name / emoji for display
//   - hue / sat / light for HSL rendering (distinct colour per morph)
//   - hex colour for UI elements
//   - genePrefs: the "ideal" genotype this morph represents
//     (morph assignment = closest genePrefs match)
//
// The gene prefs are deliberately set so that different evolutionary paths
// land in different morphs — high-MC1R frogs tend toward Crimson, high-IGF1
// toward Amethyst, high-LEP toward Amber, etc.

export const COLOR_MORPHS = [
  {
    id: 'mossback', name: '🌿 Mossback', hue: 120, sat: 50, light: 40,
    color: '#44aa55', genePrefs: { POU1F1: 0.40, THR: 0.45, MC1R: 0.45, IGF1: 0.55, LEP: 0.55, NR3C1: 0.45 },
  },
  {
    id: 'cobalt', name: '💧 Cobalt', hue: 200, sat: 60, light: 42,
    color: '#3388dd', genePrefs: { POU1F1: 0.65, THR: 0.35, MC1R: 0.60, IGF1: 0.40, LEP: 0.40, NR3C1: 0.55 },
  },
  {
    id: 'crimson', name: '🔥 Crimson', hue: 355, sat: 60, light: 38,
    color: '#dd3355', genePrefs: { POU1F1: 0.30, THR: 0.65, MC1R: 0.70, IGF1: 0.35, LEP: 0.30, NR3C1: 0.70 },
  },
  {
    id: 'amber', name: '☀️ Amber', hue: 42, sat: 65, light: 48,
    color: '#ddbb33', genePrefs: { POU1F1: 0.50, THR: 0.40, MC1R: 0.50, IGF1: 0.55, LEP: 0.70, NR3C1: 0.35 },
  },
  {
    id: 'amethyst', name: '🔮 Amethyst', hue: 280, sat: 48, light: 42,
    color: '#8844cc', genePrefs: { POU1F1: 0.55, THR: 0.55, MC1R: 0.40, IGF1: 0.70, LEP: 0.50, NR3C1: 0.40 },
  },
  {
    id: 'teal', name: '🌀 Teal', hue: 170, sat: 55, light: 38,
    color: '#33aa88', genePrefs: { POU1F1: 0.45, THR: 0.50, MC1R: 0.40, IGF1: 0.45, LEP: 0.55, NR3C1: 0.50 },
  },
];

// ── Morph Assignment ─────────────────────────────────────────────────
// Assign a genome to the nearest morph based on summed gene-preference similarity.
// A genome is "closest" to the morph whose ideal gene profile it matches best.
export function assignMorph(genome) {
  if (!genome) return COLOR_MORPHS[0];
  let best = COLOR_MORPHS[0];
  let bestScore = -Infinity;
  for (const morph of COLOR_MORPHS) {
    const prefs = morph.genePrefs;
    let score = 0;
    for (const gene of REGULATORY_GENES) {
      const diff = 1 - Math.abs((genome[gene] || 0.5) - prefs[gene]);
      score += diff;
    }
    if (score > bestScore) { bestScore = score; best = morph; }
  }
  return best;
}

// ── HSL helper for rendering ─────────────────────────────────────────
// Returns an HSL colour string with slight per-individual variation
// so not every member of a morph looks identical.
export function morphHSL(morph, variation = 0) {
  const h = morph.hue + (Math.random() - 0.5) * variation;
  const s = morph.sat + (Math.random() - 0.5) * 4;
  const l = morph.light + (Math.random() - 0.5) * 6;
  return `hsl(${h}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

// ── Cluster Detection ────────────────────────────────────────────────
// Analyse a gene pool and return which morphs are significantly represented.
// Returns array of [morphId, count, fraction] sorted by count descending.
// A cluster is "significant" if it has >= minClusterSize members AND
// at least 8% of the total pool.
export function detectMorphClusters(genePool, minClusterSize = 3) {
  const morphCounts = {};
  const total = genePool.length;
  if (total === 0) return [];

  for (const g of genePool) {
    const mId = assignMorph(g).id;
    morphCounts[mId] = (morphCounts[mId] || 0) + 1;
  }

  return Object.entries(morphCounts)
    .filter(([_, count]) => count >= minClusterSize && count / total >= 0.08)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => [id, count, count / total]);
}

// ── Morph diversity index ────────────────────────────────────────────
// Compute the Shannon diversity of morphs in the gene pool.
// 0 = all one morph, higher = more diverse.
export function morphDiversity(genePool) {
  if (genePool.length === 0) return 0;
  const counts = {};
  for (const g of genePool) {
    const mId = assignMorph(g).id;
    counts[mId] = (counts[mId] || 0) + 1;
  }
  const total = genePool.length;
  let shannon = 0;
  for (const c of Object.values(counts)) {
    const p = c / total;
    shannon -= p * Math.log2(p);
  }
  return shannon;
}

// ── Lineage History ──────────────────────────────────────────────────
// Tracks morph lineage over generations and records speciation events.
// A "split" is recorded whenever a morph appears for the first time
// in the gene pool.
export class MorphLineage {
  constructor() {
    this.history = [];   // [{ generation, counts: {morphId: count}, total }]
    this.splits = [];     // [{ generation, morphId }] — first appearance of a new morph
    this._seenMorphs = new Set();
    this._lastGen = -1;
  }

  record(generation, genePool) {
    if (generation <= this._lastGen) return;
    if (generation === this._lastGen) return;
    this._lastGen = generation;

    const clusters = detectMorphClusters(genePool, 1); // min 1 for tracking
    const counts = {};
    let total = 0;
    for (const [mId, count] of clusters) {
      counts[mId] = count;
      total += count;
    }

    this.history.push({ generation, counts, total: genePool.length });

    // Detect new morphs (speciation / lineage splitting)
    for (const mId of Object.keys(counts)) {
      if (!this._seenMorphs.has(mId)) {
        this._seenMorphs.add(mId);
        this.splits.push({ generation, morphId: mId });
      }
    }
  }

  // Get the number of distinct morph clusters currently active
  getActiveClusterCount() {
    if (this.history.length === 0) return 1;
    const last = this.history[this.history.length - 1];
    return Object.keys(last.counts).length;
  }

  // Check if speciation has occurred (2+ morphs are significantly present)
  hasSpeciation() {
    const last = this.history[this.history.length - 1];
    if (!last) return false;
    return Object.keys(last.counts).length >= 2;
  }

  // Reset for a new simulation run
  reset() {
    this.history.length = 0;
    this.splits.length = 0;
    this._seenMorphs.clear();
    this._lastGen = -1;
  }

  // ── Lineage Tree SVG ────────────────────────────────────────────────
  // Render a compact SVG lineage tree showing when each morph first appeared
  // and the branching timeline. Returns an SVG string or a "no speciation" message.
  renderLineageSVG(width = 240, height = 90) {
    if (this.splits.length < 2) {
      // No branching yet — show a straight line with the first morph
      if (this.splits.length === 1) {
        const m = COLOR_MORPHS.find(m => m.id === this.splits[0].morphId) || COLOR_MORPHS[0];
        return `<svg width="${width}" height="40" viewBox="0 0 ${width} 40" style="display:block">
          <line x1="16" y1="20" x2="${width - 16}" y2="20" stroke="#2a4a3a" stroke-width="1.5"/>
          <circle cx="16" cy="20" r="5" fill="${m.color}" stroke="#5a9a7a" stroke-width="1"/>
          <text x="${width - 20}" y="24" fill="#5a7a7a" font-size="9" font-family="system-ui" text-anchor="end">${m.name}</text>
        </svg>`;
      }
      return '<div style="color:#4a6a5a;font-size:10px;font-style:italic;padding:4px 0">gene pool too small — no branching yet</div>';
    }

    // Build the tree: we have multiple splits at different generations
    const firstGen = this.splits[0].generation;
    const lastGen = this.splits[this.splits.length - 1].generation;
    const genRange = Math.max(lastGen - firstGen, 1);

    const MARGIN_L = 18; // left margin for root dot
    const MARGIN_R = 4;  // right margin for labels
    const GRAPH_W = width - MARGIN_L - MARGIN_R;
    const LABEL_W = 54;  // width reserved for morph name labels on the right
    const LINE_W = GRAPH_W - LABEL_W;

    // Y positions per split — distribute evenly
    const nodeCount = this.splits.length;
    const nodeSpacing = nodeCount > 1 ? (height - 16) / (nodeCount - 1) : height / 2;

    // Build SVG lines and dots
    let lines = '';
    let labels = '';
    let previousLineEnd = null; // { y, gen }

    this.splits.forEach((split, i) => {
      const morph = COLOR_MORPHS.find(m => m.id === split.morphId) || COLOR_MORPHS[0];
      const y = 8 + i * nodeSpacing;
      const xFrac = Math.min((split.generation - firstGen) / genRange, 1);
      const x = MARGIN_L + xFrac * LINE_W;

      // Vertical line from previous branching point to this one
      if (previousLineEnd) {
        // Horizontal branch from previous x to this x
        lines += `<line x1="${previousLineEnd.x}" y1="${previousLineEnd.y}" x2="${x}" y2="${previousLineEnd.y}" stroke="#2a4a3a" stroke-width="1" opacity="0.5"/>`;
        // Vertical drop to this node's y
        lines += `<line x1="${x}" y1="${previousLineEnd.y}" x2="${x}" y2="${y}" stroke="#2a4a3a" stroke-width="1" opacity="0.5"/>`;
      }

      // Trunk line from left margin to first node
      if (i === 0) {
        lines += `<line x1="${MARGIN_L}" y1="${y}" x2="${x}" y2="${y}" stroke="#2a4a3a" stroke-width="1.5" opacity="0.6"/>`;
        // Root dot
        lines += `<circle cx="${MARGIN_L}" cy="${y}" r="3" fill="#1a3a3a" stroke="#3a6a5a" stroke-width="1"/>`;
      }

      // Node dot
      lines += `<circle cx="${x}" cy="${y}" r="4" fill="${morph.color}" stroke="#3a7a5a" stroke-width="1"/>`;
      // Generation label above dot
      lines += `<text x="${x}" y="${y - 7}" fill="#5a7a7a" font-size="7" font-family="system-ui" text-anchor="middle">g${split.generation}</text>`;

      // Morph name label on the right
      const labelX = width - MARGIN_R;
      labels += `<text x="${labelX}" y="${y + 3}" fill="${morph.color}" font-size="8" font-family="system-ui" text-anchor="end">${morph.name}</text>`;

      previousLineEnd = { x, y };
    });

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
      ${lines}
      ${labels}
    </svg>`;
  }
}