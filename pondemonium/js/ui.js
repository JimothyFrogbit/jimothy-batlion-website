// ── UI Controls & Stats ─────────────────────────────────────────────
import { pond } from './registry.js';
import { expressGenome, REGULATORY_GENES, PHENOTYPE_KEYS, genePool } from './genome.js';
import { assignMorph, COLOR_MORPHS } from './morphs.js';
import { drawEvoChart } from './evolution-chart.js';

// Matches each slider's `value` attribute in index.html — the "sensible
// baseline" starting point for a fresh session. Kept as one object so
// the Defaults button and the HTML can't silently drift apart from
// each other (see setupUI's defaultsBtn handler).
const DEFAULT_SETTINGS = {
  speed: 10, frogRate: 7, mosquitoRate: 8, algaeRate: 10,
  dragonflyRate: 5, stressRate: 0, volume: 10,
};

export function setupUI() {
  const speedSlider = document.getElementById('speed');
  const speedVal = document.getElementById('speed-val');
  const frogRateSlider = document.getElementById('frogRate');
  const frogRateVal = document.getElementById('frogRate-val');
  const mosquitoRateSlider = document.getElementById('mosquitoRate');
  const mosquitoRateVal = document.getElementById('mosquitoRate-val');
  const algaeRateSlider = document.getElementById('algaeRate');
  const algaeRateVal = document.getElementById('algaeRate-val');
  const dragonflyRateSlider = document.getElementById('dragonflyRate');
  const dragonflyRateVal = document.getElementById('dragonflyRate-val');
  const stressRateSlider = document.getElementById('stressRate');
  const stressRateVal = document.getElementById('stressRate-val');
  const volumeSlider = document.getElementById('volume');
  const volumeVal = document.getElementById('volume-val');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const defaultsBtn = document.getElementById('defaultsBtn');
  const csvExportBtn = document.getElementById('csvExportBtn');
  const csvGenCount = document.getElementById('csvGenCount');
  const statsDiv = document.getElementById('stats');
  const evoStatsDiv = document.getElementById('evo-stats');
  const hofStatsDiv = document.getElementById('hof-stats');
  const genNum = document.getElementById('gen-num');
  const creatureInfo = document.getElementById('creature-info');

  speedSlider.addEventListener('input', () => {
    const v = parseFloat(speedSlider.value);
    pond.speed = v <= 10 ? v / 10 : 1 + (v - 10) * (49 / 50);
    speedVal.textContent = pond.speed.toFixed(1) + '×';
    saveSettings();
  });

  frogRateSlider.addEventListener('input', () => {
    pond.frogRate = parseFloat(frogRateSlider.value);
    frogRateVal.textContent = pond.frogRate;
    saveSettings();
  });

  mosquitoRateSlider.addEventListener('input', () => {
    pond.mosquitoRate = parseFloat(mosquitoRateSlider.value);
    mosquitoRateVal.textContent = pond.mosquitoRate;
    saveSettings();
  });

  algaeRateSlider.addEventListener('input', () => {
    pond.algaeRate = parseFloat(algaeRateSlider.value);
    algaeRateVal.textContent = pond.algaeRate;
    saveSettings();
  });

  dragonflyRateSlider.addEventListener('input', () => {
    pond.dragonflyRate = parseFloat(dragonflyRateSlider.value);
    dragonflyRateVal.textContent = pond.dragonflyRate;
    saveSettings();
  });

  stressRateSlider.addEventListener('input', () => {
    pond.stressEventRate = parseFloat(stressRateSlider.value);
    stressRateVal.textContent = pond.stressEventRate > 0 ? pond.stressEventRate : 'OFF';
    const hint = document.getElementById('stressHint');
    if (hint) {
      if (pond.stressEventRate > 0) {
        const level = pond.stressEventRate <= 3 ? 'Mild' : pond.stressEventRate <= 7 ? 'Moderate' : 'Extreme';
        hint.innerHTML = `⚠️ <b>${level}</b> — stress culls the weak. Survivors evolve <b>stressResilience</b>. Dragonflies feast!`;
        hint.style.borderLeftColor = pond.stressEventRate <= 3 ? '#4a7a3a' : pond.stressEventRate <= 7 ? '#aa6633' : '#aa4444';
      } else {
        hint.innerHTML = '💡 Turn on: stress culls the weak, survivors pass resilience genes. Dragonfly nymphs feast on the chaos!';
        hint.style.borderLeftColor = '#2a4a3a';
      }
    }
    saveSettings();
  });

  volumeSlider.addEventListener('input', () => {
    const v = parseFloat(volumeSlider.value);
    pond.setVolume(v / 10);
    volumeVal.textContent = v === 0 ? 'OFF' : v;
    saveSettings();
  });

  pauseBtn.addEventListener('click', () => {
    pond.paused = !pond.paused;
    pauseBtn.textContent = pond.paused ? '▶ Play' : '⏸ Pause';
    pauseBtn.classList.toggle('active', !pond.paused);
    // Unlock audio on first interaction
    pond.initAudio();
  });

  resetBtn.addEventListener('click', () => {
    pond.reset();
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.classList.add('active');
    pond.paused = false;
  });

  // Resets ONLY the sliders above to their sensible starting values —
  // deliberately does NOT touch the running simulation (population,
  // generation count, gene pools). That's what the "⟳ Reset" button
  // next to it is for. Re-dispatches 'input' on each slider so the
  // existing handlers (which also update the displayed value + persist
  // settings) do all the actual work — this button doesn't duplicate
  // that logic, just sets values and lets it run.
  if (defaultsBtn) {
    defaultsBtn.addEventListener('click', () => {
      for (const [id, value] of Object.entries(DEFAULT_SETTINGS)) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.value = value;
        el.dispatchEvent(new Event('input'));
      }
      defaultsBtn.textContent = '✅ Defaults restored';
      setTimeout(() => { defaultsBtn.textContent = '↺ Defaults'; }, 1500);
    });
  }

  csvExportBtn.addEventListener('click', () => {
    const csv = pond.getCSV();
    if (csv.split('\n').length <= 1) {
      csvExportBtn.textContent = '⚠ No data yet';
      setTimeout(() => {
        csvExportBtn.textContent = '📥 Export CSV (' + csvGenCount.textContent + ' gen)';
      }, 1500);
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pondemonium-gen-' + pond.generation + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    csvExportBtn.textContent = '✅ Exported!';
    setTimeout(() => {
      csvExportBtn.textContent = '📥 Export CSV (' + csvGenCount.textContent + ' gen)';
    }, 2000);
  });

  return { statsDiv, evoStatsDiv, genNum, creatureInfo, csvGenCount, hofStatsDiv };
}

// ── Settings persistence ─────────────────────────────────────────
const STORAGE_KEY = 'pondemonium-settings';

function saveSettings() {
  const settings = {
    speed: document.getElementById('speed').value,
    frogRate: document.getElementById('frogRate').value,
    mosquitoRate: document.getElementById('mosquitoRate').value,
    algaeRate: document.getElementById('algaeRate').value,
    dragonflyRate: document.getElementById('dragonflyRate').value,
    stressRate: document.getElementById('stressRate').value,
    volume: document.getElementById('volume').value,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
      };
      set('speed', s.speed);
      set('frogRate', s.frogRate);
      set('mosquitoRate', s.mosquitoRate);
      set('algaeRate', s.algaeRate);
      set('dragonflyRate', s.dragonflyRate);
      set('stressRate', s.stressRate);
      set('volume', s.volume);
    }
    // Always fire input events to sync pond values + display with current slider positions
    ['speed','frogRate','mosquitoRate','algaeRate','dragonflyRate','stressRate','volume'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.dispatchEvent(new Event('input'));
    });
  } catch (e) {}
}

export function updateUI(ui) {
  const { statsDiv, evoStatsDiv, genNum, creatureInfo, csvGenCount, hofStatsDiv } = ui;
  const s = pond.getStats();

  statsDiv.innerHTML = `
    <div class="stat"><span class="key">🐸 Frog spawn</span><span class="val">${s.frogSpawns}</span></div>
    <div class="stat"><span class="key"> Tadpoles</span><span class="val ${s.tadpoles > 10 ? 'good' : 'warn'}">${s.tadpoles}</span></div>
    <div class="stat"><span class="key">🐸 Froglets</span><span class="val">${s.froglets}</span></div>
    <div class="stat"><span class="key">🚀 Frogs released</span><span class="val good">${s.frogsReleased}</span></div>
    <hr class="divider">
    <div class="stat"><span class="key"> Mosquito eggs</span><span class="val">${s.mosquitoEggs}</span></div>
    <div class="stat"><span class="key"> Mosquito larvae</span><span class="val">${s.mosquitoLarvae}</span></div>
    <div class="stat"><span class="key"> Mosquitoes</span><span class="val ${s.mosquitoes > 20 ? 'bad' : ''}">${s.mosquitoes}</span></div>
    <div class="stat"><span class="key">🦟 Released</span><span class="val">${s.mosquitoesReleased}</span></div>
    <div class="stat"><span class="key">💉 Humans bitten</span><span class="val bad">${s.humansBitten.toLocaleString()}</span></div>
    <hr class="divider">
    <div class="stat"><span class="key">🐉 Dragonfly nymphs</span><span class="val ${s.dragonflyNymphs > 5 ? 'bad' : ''}">${s.dragonflyNymphs}</span></div>
    <div class="stat"><span class="key">🐉 Dragonflies</span><span class="val">${s.dragonflies}</span></div>
    <div class="stat"><span class="key">🐉 Emerged</span><span class="val">${s.dragonfliesBirthed || 0}</span></div>
    <hr class="divider">
    <div class="stat"><span class="key">🌿 Algae</span><span class="val">${s.food}</span></div>
    <div class="stat"><span class="key">⏱ Time</span><span class="val">${Math.floor(s.time / 3600)}h ${Math.floor((s.time % 3600) / 60)}m</span></div>
    <hr class="divider">
    <div class="stat"><span class="key">${s.stressEventActive ? '⚠ ' + s.stressEventActive : '✅ Calm'}</span><span class="val">${s.stressEventsTotal} events</span></div>
    <div style="font-size:10px;margin-top:4px;padding-top:4px;border-top:1px solid #2a2a3a">
      ${s.stressEventLog.length > 0 ? s.stressEventLog.map(e => {
        const icon = e.survived === true ? '✅' : e.survived === null ? '⚠' : '⏹';
        const deathStr = e.deaths > 0 ? `<span style="color:#cc5555">${e.deaths} died</span>` : 'no deaths';
        return `<div style="color:${e.survived === null ? '#ddaa44' : '#6a8a7a'};margin-bottom:2px">
          ${icon} ${e.name} ${e.duration}s — ${deathStr}
        </div>`;
      }).join('') : '<div style="color:#4a6a5a;font-style:italic">no events yet</div>'}
    </div>
    <hr class="divider">
    <div class="stat"><span class="key" style="color:${s.seasonColor}">${s.season}</span><span class="val">${s.timeOfDay}</span></div>
  `;

  genNum.textContent = s.generation;
  csvGenCount.textContent = pond.generationData.length;

  const evo = pond.getEvoStats();
  if (evo && s.generation > 0) {
    evoStatsDiv.innerHTML = REGULATORY_GENES.map(k => {
      const v = evo[k];
      const hue = v * 120 + 40;
      return `<div class="stat"><span class="key">${k}</span><span class="val"><span class="evo-tag" style="background:hsl(${hue},60%,45%)"></span>${v.toFixed(3)}</span></div>`;
    }).join('') +
    // ── Morph Distribution ──
    '<hr class="divider" style="margin-top:6px">' +
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:#5a7a7a;margin-bottom:4px">' +
      '<span>🎨 Morphs</span>' +
      '<span>d:' + s.morphDiversity.toFixed(2) + '</span>' +
    '</div>' +
    (s.morphClusters.length > 0
      ? s.morphClusters.map(([mId, count, frac]) => {
          const morph = COLOR_MORPHS.find(m => m.id === mId) || COLOR_MORPHS[0];
          const pct = (frac * 100).toFixed(0);
          return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:10px">
            <span class="evo-tag" style="background:${morph.color};width:8px;height:8px"></span>
            <span style="color:#6a8a7a;min-width:48px">${morph.name.split(' ')[1]}</span>
            <div style="flex:1;height:8px;background:#1a1a30;border-radius:4px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${morph.color};border-radius:4px;transition:width 0.3s"></div>
            </div>
            <span style="color:#7a9a8a;min-width:28px;text-align:right;font-variant-numeric:tabular-nums">${pct}%</span>
          </div>`;
        }).join('') + '<div style="color:#5a7a7a;font-size:8px;margin-top:1px">' + s.activeMorphCount + ' morphs · ' + s.morphClusters.reduce((sum, [,c]) => sum + c, 0) + ' frogs</div>'
      : '<div style="color:#4a6a5a;font-size:10px;font-style:italic">gene pool too small for clustering</div>'
    ) +
    (s.morphSplits && s.morphSplits.length >= 1
      ? '<div style="margin-top:4px;padding-top:4px;border-top:1px solid #2a2a3a">' + pond.morphLineage.renderLineageSVG() + '</div>'
      : ''
    ) +
    '<div style="color:#5a7a7a;font-size:9px;margin-top:4px;border-top:1px solid #2a2a3a;padding-top:3px">regulatory genes + morph distribution</div>';
  } else {
    const tips = [
      '🐸 Tadpoles grow into froglets, then leave = generation 1',
      '💡 Pro tip: crank up Speed to 4× and wait for the first frog to leave!',
      '🐸 Frog spawn → tadpoles → froglets → 🚀 RELEASE = generation 1',
      '💡 Keep frog spawn rate ≥ 5 to get your first lifecycle going',
    ];
    const tipIdx = Math.floor((pond.simulationTime || 0) / 1800) % tips.length;
    evoStatsDiv.innerHTML = '<div style="color:#5a7a7a;font-size:11px;">' + tips[tipIdx] + '</div>';
  }

  // ── Hall of Fame ──
  const hof = pond.getHallOfFame();
  if (hof && hof.length > 0) {
    hofStatsDiv.innerHTML = hof.map((g, i) => {
      const morph = assignMorph(g);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▸';
      return `<div class="stat"><span class="key">${medal} #${g._id}</span><span class="val good">${g._offspring} offspring</span></div>
<div style="font-size:9px;color:#5a7a7a;padding-left:14px;margin-bottom:4px"><span class="evo-tag" style="background:${morph.color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1)"></span>${morph.name} · ${REGULATORY_GENES.map(k => g[k].toFixed(2)).join(' · ')}</div>`;
    }).join('');
    hofStatsDiv.innerHTML += '<div style="color:#5a7a7a;font-size:9px;margin-top:2px;border-top:1px solid #2a2a3a;padding-top:3px">most prolific breeders by offspring count</div>';
  } else {
    hofStatsDiv.innerHTML = '<div style="color:#5a7a7a;font-size:11px;">Waiting for first generation...</div>';
  }

  const h = pond.hoveredEntity;
  if (h) {
    if (h.genome) {
      const morph = assignMorph(h.genome);
      const geneStrs = REGULATORY_GENES.map(k => `${k}: ${h.genome[k].toFixed(2)}`).join(' · ');
      const p = expressGenome(h.genome);
      const pdStrs = PHENOTYPE_KEYS.map(k => `${k}: ${p[k].toFixed(2)}`).join(' · ');
      creatureInfo.innerHTML = `<span class="evo-tag" style="background:${morph.color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1)"></span> ${morph.name} · 🧬 ${geneStrs}<br><span style="color:#6a9a7a">→ ${pdStrs}</span>`;
    } else {
      creatureInfo.textContent = 'click a creature with DNA to see its genes';
    }
  } else {
    creatureInfo.textContent = 'hover over a creature to inspect genotype & phenotype';
  }

  // ── Evolution Trend Chart ──
  const evoChart = document.getElementById('evo-chart');
  if (evoChart) {
    drawEvoChart(evoChart, pond.generationData);
  }
}

// ── Gene Browser ─────────────────────────────────────────────────
const genomeCard = document.getElementById('genome-card');
const genomeEntityInfo = document.getElementById('genome-entity-info');
const genomeGenotypeBars = document.getElementById('genome-genotype-bars');
const genomePhenotypeBars = document.getElementById('genome-phenotype-bars');
const genomeAncestors = document.getElementById('genome-ancestors');
const genomeCloseBtn = document.getElementById('genome-close-btn');

if (genomeCloseBtn) {
  genomeCloseBtn.addEventListener('click', () => selectForGeneBrowser(null));
}

export function selectForGeneBrowser(entity) {
  if (!entity || !entity.genome) {
    if (genomeCard) genomeCard.style.display = 'none';
    return;
  }
  if (genomeCard) genomeCard.style.display = 'block';

  const SPECIES_NAMES = {
    frogSpawn: '🐸 Frog Spawn',
    tadpole: ' Tadpole',
    froglet: '🐸 Froglet',
    mosquito: '🦟 Mosquito',
    dragonflyNymph: '🐉 Dragonfly Nymph',
    dragonflyAdult: '🐉 Dragonfly',
    food: '🌿 Algae',
  };
  const name = SPECIES_NAMES[entity.species] || 'Unknown';

  const ageStr = (entity.age / 60).toFixed(0) + 's';
  const morph = assignMorph(entity.genome);
  const parentStr = entity.genome._parentIds && entity.genome._parentIds.length > 0
    ? 'parents: #' + entity.genome._parentIds.join(', #') : 'wild type (no recorded parents)';
  genomeEntityInfo.innerHTML = `<strong>${name}</strong> · <span class="evo-tag" style="background:${morph.color};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:2px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1)"></span> ${morph.name} · id:${entity.id} · age:${ageStr}<br><span style="color:#6a9a7a;font-size:10px">${parentStr}</span>`;

  const g = entity.genome;
  genomeGenotypeBars.innerHTML = REGULATORY_GENES.map(k => {
    const v = g[k];
    const hue = v * 120 + 40;
    return `<div class="gene-bar-row">
      <span class="gene-bar-label">${k}</span>
      <div class="gene-bar-track"><div class="gene-bar-fill" style="width:${v*100}%;background:hsl(${hue},60%,50%)"></div></div>
      <span class="gene-bar-val">${v.toFixed(3)}</span>
    </div>`;
  }).join('');

  const p = expressGenome(g);
  genomePhenotypeBars.innerHTML = PHENOTYPE_KEYS.map(k => {
    const v = p[k];
    const hue = k === 'hue' ? v * 360 : v * 120;
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    return `<div class="gene-bar-row">
      <span class="gene-bar-label">${label}</span>
      <div class="gene-bar-track"><div class="gene-bar-fill" style="width:${v*100}%;background:hsl(${hue},65%,50%)"></div></div>
      <span class="gene-bar-val">${v.toFixed(3)}</span>
    </div>`;
  }).join('');

  const parentIds = entity.genome._parentIds || [];
  const gp = genePool; // from genome.js import
  const ancestors = parentIds.map(id => gp.find(e => e._id === id)).filter(Boolean);

  if (ancestors.length > 0) {
    genomeAncestors.innerHTML = ancestors.map((a, i) => {
      const morph = assignMorph(a);
      const geneStr = REGULATORY_GENES.map(k => `${k}:${a[k].toFixed(2)}`).join(' ');
      const medal = a._offspring > 50 ? '🥇' : a._offspring > 10 ? '🌟' : '';
      return `<div class="genome-ancestor-entry">
        <span class="ancestor-id">#${a._id}</span> ${medal}
        <span class="ancestor-offspring">${a._offspring} offspring</span>
        <div class="ancestor-genes"><span class="evo-tag" style="background:${morph.color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1)"></span>${morph.name} · ${geneStr}</div>
      </div>`;
    }).join('');
    // Grandparent trail
    const grandparentIds = [];
    ancestors.forEach(a => {
      if (a._parentIds) a._parentIds.forEach(pid => { if (!grandparentIds.includes(pid)) grandparentIds.push(pid); });
    });
    if (grandparentIds.length > 0) {
      const grandparents = grandparentIds.map(id => gp.find(e => e._id === id)).filter(Boolean);
      if (grandparents.length > 0) {
        genomeAncestors.innerHTML += '<div style="color:#4a6a5a;font-size:9px;margin-top:4px">earlier ancestors:</div>';
        genomeAncestors.innerHTML += grandparents.map(a => {
          const geneStr = REGULATORY_GENES.map(k => `${k}:${a[k].toFixed(2)}`).join(' ');
          return `<div class="genome-ancestor-entry" style="opacity:0.7">
            <span class="ancestor-id">#${a._id}</span>
            <div class="ancestor-genes">${geneStr}</div>
          </div>`;
        }).join('');
      }
    }
  } else {
    genomeAncestors.innerHTML = '<div style="color:#5a7a7a;font-size:11px;">No ancestors recorded</div>';
  }
}