// ── Controls UI ─────────────────────────────────────────────────────
// Stats panel, speed slider, reset button for the Evolution Lab v2.

export class ControlsUI {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(20, 40, 20, 0.9);
      border: 1px solid #446644;
      border-radius: 8px;
      padding: 12px;
      color: #aaccaa;
      font-family: monospace;
      font-size: 12px;
      min-width: 180px;
    `;

    this._build();
    container.appendChild(this.panel);
  }

  _build() {
    this.panel.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; color: #88cc44;">
        🧬 Evolution Lab v2
      </div>
      <div class="stat-row" style="margin-bottom: 4px;">
        <span>Pop:</span> <span id="stat-pop">0</span>
      </div>
      <div class="stat-row" style="margin-bottom: 4px;">
        <span>Gen:</span> <span id="stat-gen">0</span>
      </div>
      <div class="stat-row" style="margin-bottom: 4px;">
        <span>Food:</span> <span id="stat-food">0</span>
      </div>
      <div class="stat-row" style="margin-bottom: 4px;">
        <span>Species:</span> <span id="stat-species">0</span>
      </div>
      <div class="stat-row" style="margin-bottom: 8px;">
        <span>Speed:</span>
        <input type="range" id="sim-speed" min="0" max="4" step="0.5" value="1"
               style="width: 80px; vertical-align: middle;">
      </div>
      <div style="display: flex; gap: 4px; margin-bottom: 6px;">
        <button id="btn-pause" style="flex:1; background:#664422; color:#ccaa88; border:1px solid #996644; border-radius:4px; cursor:pointer; padding:4px 8px; font-family:monospace; font-size:11px;">
          ⏸ Pause
        </button>
        <button id="btn-spawn" style="flex:1; background:#446644; color:#aaccaa; border:1px solid #669966; border-radius:4px; cursor:pointer; padding:4px 8px; font-family:monospace; font-size:11px;">
          +Critter
        </button>
        <button id="btn-reset" style="flex:1; background:#664444; color:#ccaaaa; border:1px solid #996666; border-radius:4px; cursor:pointer; padding:4px 8px; font-family:monospace; font-size:11px;">
          Reset
        </button>
      </div>
      <div id="species-legend" style="margin-top: 6px; font-size: 10px; line-height: 1.6; color: #668866;">
        <div style="color: #88cc44; margin-bottom: 2px;">Species:</div>
        <div id="legend-entries">Waiting for clustering...</div>
      </div>
      <div style="font-size: 10px; color: #668866; margin-top: 6px; line-height: 1.4;">
        Species emerge from genetics — no hardcoded types.
      </div>
    `;

    this._popSpan = this.panel.querySelector('#stat-pop');
    this._genSpan = this.panel.querySelector('#stat-gen');
    this._foodSpan = this.panel.querySelector('#stat-food');
    this._speciesSpan = this.panel.querySelector('#stat-species');
    this._speedInput = this.panel.querySelector('#sim-speed');
    this._pauseBtn = this.panel.querySelector('#btn-pause');
    this._legendEl = this.panel.querySelector('#legend-entries');

    this._speedInput.addEventListener('input', () => {
      if (this.callbacks.onSpeedChange) {
        this.callbacks.onSpeedChange(parseFloat(this._speedInput.value));
      }
    });

    this._pauseBtn.addEventListener('click', () => {
      if (this.callbacks.onPauseToggle) this.callbacks.onPauseToggle();
    });

    this.panel.querySelector('#btn-spawn').addEventListener('click', () => {
      if (this.callbacks.onSpawnCritter) this.callbacks.onSpawnCritter();
    });

    this.panel.querySelector('#btn-reset').addEventListener('click', () => {
      if (this.callbacks.onReset) this.callbacks.onReset();
    });
  }

  /** Set the pause button text to reflect current state. */
  setPaused(paused) {
    if (this._pauseBtn) {
      this._pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
    }
  }

  updateStats(pop, gen, food, species) {
    if (this._popSpan) this._popSpan.textContent = pop;
    if (this._genSpan) this._genSpan.textContent = gen;
    if (this._foodSpan) this._foodSpan.textContent = food;
    if (this._speciesSpan) this._speciesSpan.textContent = species != null ? species : '-';
  }

  /**
   * Update the species legend with active clusters.
   * @param {Array} speciesData — array of {name, color, count, isSpecies}
   */
  updateSpecies(speciesData) {
    if (!this._legendEl || !speciesData || speciesData.length === 0) {
      if (this._legendEl) this._legendEl.textContent = 'Waiting for clustering...';
      return;
    }
    this._legendEl.innerHTML = speciesData
      .filter(s => s.count > 0)
      .map(s => {
        const label = s.isSpecies ? s.name : `${s.name} (variant)`;
        return `<span style="display:inline-block; margin-right: 8px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%;
               background:${s.color}; vertical-align:middle; margin-right:3px;"></span>
          ${label}: ${s.count}
        </span>`;
      })
      .join(' ');
  }

  get speed() {
    return parseFloat(this._speedInput ? this._speedInput.value : '1');
  }
}
