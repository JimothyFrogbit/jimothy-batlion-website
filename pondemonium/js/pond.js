// ── Pond Ecosystem ───────────────────────────────────────────────────
import { registerPond, pond } from './registry.js';
import { expressGenome, genePool, REGULATORY_GENES, PHENOTYPE_KEYS, sampleGenePool, mosquitoGenePool, dragonflyGenePool, algaeGenePool, getHallOfFame, resetPool } from './genome.js';
import { rand, randInt, lerp, clamp } from './utils.js';
import { selectForGeneBrowser } from './ui.js';
import { Food } from './entities/Food.js';
import { FrogSpawn } from './entities/FrogSpawn.js';
import { Tadpole } from './entities/Tadpole.js';
import { Froglet } from './entities/Froglet.js';
import { MosquitoEggRaft } from './entities/MosquitoEggRaft.js';
import { MosquitoLarva } from './entities/MosquitoLarva.js';
import { Mosquito } from './entities/Mosquito.js';
import { DragonflyNymph } from './entities/DragonflyNymph.js';
import { DragonflyAdult } from './entities/DragonflyAdult.js';
import { Particle } from './entity.js';
import { assignMorph, detectMorphClusters, MorphLineage, morphDiversity } from './morphs.js';
import { initEcs, adoptEntity, syncPosition, resetEcsWorld, ecsWorld } from './ecs/adapter.js';

const CANVAS_W = 700, CANVAS_H = 700;
const POND_MARGIN = 20;
const POND_X = POND_MARGIN, POND_Y = POND_MARGIN;
const POND_W = CANVAS_W - 2 * POND_MARGIN, POND_H = CANVAS_H - 2 * POND_MARGIN;

// ── Stress Event Types ───────────────────────────────────────────────
const STRESS_EVENTS = [
  { id: 'tempSpike', name: '🌡️ TEMPERATURE SPIKE', color: '#ff6a00', duration: 60, severity: 0.035 },
  { id: 'pHShift',   name: '🧪 pH SHIFT',         color: '#aa44ff', duration: 80, severity: 0.025 },
  { id: 'toxinBloom', name: '☣️ TOXIN BLOOM',      color: '#44dd44', duration: 50, severity: 0.040 },
  { id: 'drought',    name: '🏜️ DROUGHT',          color: '#cccc88', duration: 100, severity: 0.020 },
];

export class Pond {
  constructor(canvas) {
    registerPond(this);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = CANVAS_W;
    this.height = CANVAS_H;

    this.food = [];
    this.frogSpawns = [];
    this.tadpoles = [];
    this.froglets = [];
    this.mosquitoEggs = [];
    this.mosquitoLarvae = [];
    this.mosquitoes = [];
    this.particles = [];
    this.dragonflyNymphs = [];
    this.dragonflies = [];

    this.frogTimer = 0;
    this.mosquitoTimer = 0;
    this.dragonflyTimer = 0;
    this.algaeTimer = 0;
    this.stressTimer = 0;
    this.stressEventRate = 0;
    this.activeEvent = null;
    this.stressEventsSurvived = 0;
    this.stressEventsTotal = 0;
    this.stressEventLog = [];  // [{time, name, color, duration, survived, severity}]

    // ── Seasonal Cycles ──
    this.seasonCycle = 0.25;          // 0→1, starts in spring
    this.seasonCycleSpeed = 0.00005;  // full cycle ~ every 5.8 min at 1× (10x real time)
    this.dayCycle = 0.5;             // 0→1, starts at noon
    this.dayCycleSpeed = 0.0006;      // full day/night ~ every 29s at 1× (10x real time)
    this.SEASONS = ['🌱 Spring', '☀️ Summer', '🍂 Autumn', '❄️ Winter'];
    this.SEASON_COLORS = ['#44cc44', '#ffcc44', '#cc6633', '#88bbdd'];

    this.speed = 1;
    this.frogRate = 7;
    this.mosquitoRate = 8;
    this.dragonflyRate = 5;
    this.algaeRate = 10;
    this.paused = false;

    this.frogsReleased = 0;
    this.mosquitoesReleased = 0;
    this.humansBitten = 0;
    this.dragonfliesReleased = 0;
    this.dragonfliesBirthed = 0;
    this.totalSpawnLaid = 0;
    this.generation = 0;
    this.simulationTime = 0;
    this.generationData = [];
    this._lastRecordedGen = -1;
    this.hallOfFame = [];

    this.lilyPads = [];
    for (let i = 0; i < 6; i++) {
      this.lilyPads.push({ x: rand(POND_X + 30, POND_X + POND_W - 30), y: rand(POND_Y + 30, POND_Y + POND_H - 30), r: rand(15, 30), phase: rand(0, Math.PI * 2) });
    }
    this.ripples = [];
    this.rippleTimer = 0;

    this.hoveredEntity = null;
    this.debugMode = false;

    // ── Morph / Speciation tracking ──
    this.morphLineage = new MorphLineage();
    this.currentMorphs = []; // [{morph, count, fraction}]

    // ── Audio System ──
    this._audioCtx = null;
    this._masterGain = null;
    this.volume = 1.0;
    this._croakTimer = 0;
    this._buzzTimer = 0;
    this._wingTimer = 0;

    // Toggle debug overlay with 'D' key
    document.addEventListener('keydown', (e) => {
      this.initAudio(); // Unlock audio on any keypress
      if (e.key === 'd' || e.key === 'D') {
        this.debugMode = !this.debugMode;
      }
    });
    this.selectedEntity = null;
    this.mouseX = 0; this.mouseY = 0;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    });
    canvas.addEventListener('mouseleave', () => { this.mouseX = -1; this.mouseY = -1; });
    canvas.addEventListener('click', (e) => {
      this.initAudio(); // Unlock audio on first canvas click
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      this.selectedEntity = this.getEntityAt(mx, my);
      selectForGeneBrowser(this.selectedEntity && this.selectedEntity.genome ? this.selectedEntity : null);
    });
    // ── ECS Phase 3: Initialise ECS world before seed so initial entities get adopted ──
    initEcs(this);
    this.seed();
  }

  seed() {
    for (let i = 0; i < 60; i++) this.addFood(new Food(rand(POND_X + 10, POND_X + POND_W - 10), rand(POND_Y + 10, POND_Y + POND_H - 10)));
    for (let i = 0; i < 5; i++) this.addTadpole(new Tadpole(rand(POND_X + 30, POND_X + POND_W - 30), rand(POND_Y + 30, POND_Y + POND_H - 30)));
  }

  addFood(f) { this.food.push(f); adoptEntity(f, 'food'); }
  addFrogSpawn(s) { this.frogSpawns.push(s); this.totalSpawnLaid++; adoptEntity(s, 'frogSpawn'); }
  addTadpole(t) { this.tadpoles.push(t); adoptEntity(t, 'tadpole'); }
  addFroglet(f) { this.froglets.push(f); adoptEntity(f, 'froglet'); }
  addMosquitoEgg(e) { this.mosquitoEggs.push(e); adoptEntity(e, 'mosquitoEgg'); }
  addMosquitoLarva(l) { this.mosquitoLarvae.push(l); adoptEntity(l, 'mosquitoLarva'); }
  addMosquito(m) { this.mosquitoes.push(m); adoptEntity(m, 'mosquito'); }
  addDragonflyNymph(n) { this.dragonflyNymphs.push(n); adoptEntity(n, 'dragonflyNymph'); }
  addDragonfly(d) { this.dragonflies.push(d); this.dragonfliesBirthed++; adoptEntity(d, 'dragonflyAdult'); }

  /** Enable ECS mode — pond.update() skips entity logic, only does rendering. */
  enableEcsMode() {
    this._ecsMode = true;
  }

  /** Store ECS system references for state sync. */
  setEcsSystems(stressSystem, reproductionSystem, releaseSystem) {
    this._ecsStressSystem = stressSystem;
    this._ecsReproductionSystem = reproductionSystem;
    this._ecsReleaseSystem = releaseSystem;
  }

  /** Set stress event rate, propagating to ECS system if active. */
  setStressEventRate(v) {
    this._stressEventRateProp = v;
    if (this._ecsStressSystem) {
      this._ecsStressSystem._stressEventRate = v;
    }
  }

  /** Season timer updates only (no entity spawning — handled by ECS). */
  _processSeasons(t, seasonIdx) {
    const algaeMult = seasonIdx === 1 ? 1.6 : seasonIdx === 3 ? 0.4 : 1.0;
    const frogMult  = seasonIdx === 1 ? 0.8 : seasonIdx === 3 ? 0.9 : 1.0;
    const mosquitoMult = seasonIdx === 1 ? 1.3 : seasonIdx === 3 ? 0.5 : 1.0;
    this.frogTimer += t * (this.frogRate / 10) * frogMult;
    this.mosquitoTimer += t * (this.mosquitoRate / 10) * (this.mosquitoRate > 0 ? mosquitoMult : 1);
    this.algaeTimer += t * (this.algaeRate / 10) * algaeMult;
    this.dragonflyTimer += t * (this.dragonflyRate / 10);
  }

  /** Stress event timer and lifecycle only (ECS StressSystem applies damage). */
  _processStressEvents(t) {
    if (this.stressEventRate > 0) {
      this.stressTimer += t * (this.stressEventRate / 6);
      if (!this.activeEvent && this.stressTimer > 180) {
        this.stressTimer = 0;
        this.triggerStressEvent();
      }
      if (this.activeEvent) {
        this.activeEvent.elapsed += t;
        if (this.activeEvent.elapsed >= this.activeEvent.duration) {
          this.stressEventsSurvived++;
          for (const entry of this.stressEventLog) {
            if (entry.survived === null) { entry.survived = true; break; }
          }
          this.activeEvent = null;
        }
      }
    }
  }

  update(dt) {
    if (this.paused) return;
    const t = dt * this.speed;
    this.simulationTime += t;

    // ── Seasonal modifier computation (hoisted: used by timers below) ──
    this.seasonCycle = (this.seasonCycle + t * this.seasonCycleSpeed) % 1;
    this.dayCycle = (this.dayCycle + t * this.dayCycleSpeed) % 1;
    const seasonIdx = Math.floor(this.seasonCycle * 4);

    // ── ECS Mode: ECS systems handle entity logic ──
    // Main.js runs ecsWorld.update() + ecsWorld.reapDead() each sub-step.
    // syncEcsToPond() repopulates render arrays between update and render.
    // Here we handle non-entity housekeeping and sync state from ECS systems.
    if (this._ecsMode) {
      // Sync stress event state from ECS StressSystem
      if (this._ecsStressSystem) {
        this.activeEvent = this._ecsStressSystem.activeEvent
          ? { ...this._ecsStressSystem.activeEvent }
          : null;
        this.stressEventsTotal = this._ecsStressSystem.eventsTotal;
        this.stressEventLog = this._ecsStressSystem.eventLog?.slice(0, 10) || [];
          // Propagate stress event rate so ECS system respects slider
        if (this._stressEventRateProp !== undefined) {
          this._ecsStressSystem._stressEventRate = this._stressEventRateProp;
        }
      }

      // Propagate reproduction rates to ECS system so UI sliders work
      if (this._ecsReproductionSystem) {
        this._ecsReproductionSystem.setFrogRate(this.frogRate);
        this._ecsReproductionSystem.setMosquitoRate(this.mosquitoRate);
        this._ecsReproductionSystem.setDragonflyRate(this.dragonflyRate);
        this._ecsReproductionSystem.setAlgaeRate(this.algaeRate);
      }

      // Sync release stats from ECS ReleaseSystem
      if (this._ecsReleaseSystem) {
        const stats = this._ecsReleaseSystem.getReleaseStats();
        this.frogsReleased = stats.frogsReleased;
        this.generation = stats.generation;
      }

      // Ripples (visual effects, not entity-dependent)
      this.rippleTimer += t;
      if (this.rippleTimer > 30 && Math.random() < 0.05) {
        this.ripples.push({ x: rand(POND_X + 40, POND_X + POND_W - 40), y: rand(POND_Y + 40, POND_Y + POND_H - 40), r: 2, maxR: rand(15, 40), alpha: 0.4 });
        this.rippleTimer = 0;
      }
      this.ripples = this.ripples.filter(r => { r.r += 0.15 * t; r.alpha -= 0.003 * t; return r.alpha > 0 && r.r < r.maxR; });

      // Morph tracking — query ECS Species store for diversity
      this.currentMorphs = detectMorphClusters(genePool, 2);
      if (this.morphLineage) {
        this.morphLineage.record(this.generation, genePool);
      }

      // Audio (uses entity counts from ECS world queries)
      if (ecsWorld) {
        this.updateAudio(t);
      }

      // Skip entity loops, spawning, eating — all handled by ECS systems
      return;
    }

    // ── Legacy mode (no ECS) — full entity loops ──
    const seasonT = (this.seasonCycle * 4) % 1;
    const algaeMult = seasonIdx === 1 ? 1.6 : seasonIdx === 3 ? 0.4 : 1.0;
    const frogMult  = seasonIdx === 1 ? 0.8 : seasonIdx === 3 ? 0.9 : 1.0;
    const mosquitoMult = seasonIdx === 1 ? 1.3 : seasonIdx === 3 ? 0.5 : 1.0;
    const metMult = seasonIdx === 3 ? 1.15 : 1.0;

    this.frogTimer += t * (this.frogRate / 10) * frogMult;
    this.mosquitoTimer += t * (this.mosquitoRate / 10) * (this.mosquitoRate > 0 ? mosquitoMult : 1);
    this.algaeTimer += t * (this.algaeRate / 10) * algaeMult;

    if (this.frogTimer > 80) { this.frogTimer = 0; this.spawnFrogEggs(); }
    if (this.mosquitoTimer > 60) { this.mosquitoTimer = 0; this.spawnMosquitoEggs(); }
    this.dragonflyTimer += t * (this.dragonflyRate / 10);
    if (this.dragonflyTimer > 120 && this.dragonflyNymphs.length < 12) { this.dragonflyTimer = 0; this.spawnDragonflyNymph(); }
    if (this.algaeTimer > 15 && this.food.length < 250) {
      this.algaeTimer = 0;
      const n = randInt(1, 3);
      for (let i = 0; i < n; i++) this.addFood(new Food(rand(POND_X + 10, POND_X + POND_W - 10), rand(POND_Y + 10, POND_Y + POND_H - 10)));
    }

    // ── Stress Events ──
    if (this.stressEventRate > 0) {
      this.stressTimer += t * (this.stressEventRate / 6);
      if (!this.activeEvent && this.stressTimer > 180) {
        this.stressTimer = 0;
        this.triggerStressEvent();
      }
      if (this.activeEvent) {
        this.activeEvent.elapsed += t;
        this.processStressEventTick(t);
        if (this.activeEvent.elapsed >= this.activeEvent.duration) {
          this.stressEventsSurvived++;
          // Mark latest unmarked log entry as survived
          for (const entry of this.stressEventLog) {
            if (entry.survived === null) { entry.survived = true; break; }
          }
          this.activeEvent = null;
        }
      }
    }

    // ── Entity Updates ──
    this.updateEntities(this.frogSpawns, t);
    this.updateEntities(this.tadpoles, t);
    this.updateEntities(this.froglets, t);
    this.updateEntities(this.mosquitoEggs, t);
    this.updateEntities(this.mosquitoLarvae, t);
    this.updateEntities(this.mosquitoes, t);
    this.updateEntities(this.dragonflyNymphs, t);
    this.updateEntities(this.dragonflies, t);

    this.processEating();
    this.processMosquitoEating();
    this.processDragonflyEating();

    this.rippleTimer += t;
    if (this.rippleTimer > 30 && Math.random() < 0.05) {
      this.ripples.push({ x: rand(POND_X + 40, POND_X + POND_W - 40), y: rand(POND_Y + 40, POND_Y + POND_H - 40), r: 2, maxR: rand(15, 40), alpha: 0.4 });
      this.rippleTimer = 0;
    }
    this.ripples = this.ripples.filter(r => { r.r += 0.15 * t; r.alpha -= 0.003 * t; return r.alpha > 0 && r.r < r.maxR; });

    this.updateEntities(this.particles, t);

    // ── ECS Phase 2: Run systems in parallel ──
    // Old entity code is source of truth. ECS reads mirrored components,
    // computes independent results for future comparison/verification.
    if (ecsWorld) {
      // Sync old entity positions → ECS components
      this._syncAllPositions();
      // Run ECS systems
      ecsWorld.update(t);
      // Clean up dead ECS entities
      ecsWorld.reapDead();
    }

    this.food = this.food.filter(e => e.alive);
    this.frogSpawns = this.frogSpawns.filter(e => e.alive);
    this.tadpoles = this.tadpoles.filter(e => e.alive);
    this.froglets = this.froglets.filter(e => e.alive);
    this.mosquitoEggs = this.mosquitoEggs.filter(e => e.alive);
    this.mosquitoLarvae = this.mosquitoLarvae.filter(e => e.alive);
    this.mosquitoes = this.mosquitoes.filter(e => e.alive);
    this.particles = this.particles.filter(e => e.alive);
    this.dragonflyNymphs = this.dragonflyNymphs.filter(e => e.alive);
    this.dragonflies = this.dragonflies.filter(e => e.alive);

    if (this.food.length > 300) this.food.splice(0, this.food.length - 300);
    if (this.tadpoles.length > 120) { this.tadpoles.sort((a, b) => a.energy - b.energy); this.tadpoles.splice(60); }

    // Record generation data on increment
    if (this.generation > this._lastRecordedGen) {
      this._lastRecordedGen = this.generation;
      this.recordGenerationData();
    }

    // ── Morph / Speciation tracking ──
    this.morphLineage.record(this.generation, genePool);
    this.currentMorphs = detectMorphClusters(genePool, 2);

    this.hoveredEntity = this.getEntityAt(this.mouseX, this.mouseY);

    // ── Ambient Audio ──
    this.updateAudio(t);
  }

  // ── Audio System ──────────────────────────────────────────────────
  initAudio() {
    if (!this._audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this._audioCtx = new AC();
        this._masterGain = this._audioCtx.createGain();
        this._masterGain.gain.value = this.volume;
        this._masterGain.connect(this._audioCtx.destination);
      }
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) {
      this._masterGain.gain.value = this.volume;
    }
  }

  _playCroak() {
    try {
      if (!this._audioCtx) return;
      const ctx = this._audioCtx;
      const t = ctx.currentTime;
      // Low croak: two descending tones
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(80 + Math.random() * 20, t + 0.15);
      gain.gain.setValueAtTime(0.04 + Math.random() * 0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
      // Second burst
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(140 + Math.random() * 30, t + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(70, t + 0.35);
      gain2.gain.setValueAtTime(0.03, t + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc2.connect(gain2);
      gain2.connect(this._masterGain);
      osc2.start(t + 0.2);
      osc2.stop(t + 0.45);
    } catch(e) { /* audio may not be available */ }
  }

  _playBuzz() {
    try {
      if (!this._audioCtx) return;
      const ctx = this._audioCtx;
      const t = ctx.currentTime;
      // Mosquito buzz: high frequency with fast tremolo
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + Math.random() * 100, t);
      lfo.frequency.setValueAtTime(25 + Math.random() * 10, t);
      lfo.type = 'sine';
      lfoGain.gain.setValueAtTime(0.15, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(t); osc.stop(t + 0.8);
      lfo.start(t); lfo.stop(t + 0.8);
    } catch(e) {}
  }

  _playWing() {
    try {
      if (!this._audioCtx) return;
      const ctx = this._audioCtx;
      const t = ctx.currentTime;
      // Dragonfly wing rustle: short noise burst
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3000, t);
      bp.Q.setValueAtTime(2, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(bp);
      bp.connect(gain);
      gain.connect(this._masterGain);
      noise.start(t);
    } catch(e) {}
  }

  updateAudio(t) {
    if (!this._audioCtx) return;
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }

    // Count entities — use ECS world in ECS mode, pond arrays otherwise
    let wellFedFrogs = 0;
    let buzzingMosquitoes = 0;
    let flyingDragonflies = 0;

    if (this._ecsMode && ecsWorld) {
      const energyStore = ecsWorld.getStore('Energy');
      const speciesStore = ecsWorld.getStore('Species');
      if (energyStore && speciesStore) {
        for (const [eid] of energyStore.getAll()) {
          const sp = speciesStore.get(eid);
          const en = energyStore.get(eid);
          if (!sp || !en) continue;
          if (sp.type === 'froglet' && en.satiation > 60) wellFedFrogs++;
          if (sp.type === 'mosquito') buzzingMosquitoes++;
          if (sp.type === 'dragonflyAdult') flyingDragonflies++;
        }
      }
    } else {
      wellFedFrogs = this.froglets.filter(f => f.alive && f.satiation > 60).length;
      buzzingMosquitoes = this.mosquitoes.filter(m => m.alive).length;
      flyingDragonflies = this.dragonflies.filter(d => d.alive).length;
    }

    // Croak: well-fed froglets croak every ~2-8 seconds
    this._croakTimer += t;
    const croakInterval = 120 + 500 / Math.max(1, wellFedFrogs);
    if (this._croakTimer > croakInterval && wellFedFrogs > 0) {
      this._croakTimer = 0;
      this._playCroak();
    }

    // Buzz: mosquitoes buzz more when abundant
    this._buzzTimer += t;
    const buzzInterval = 200 + 600 / Math.max(1, buzzingMosquitoes);
    if (this._buzzTimer > buzzInterval && buzzingMosquitoes > 2) {
      this._buzzTimer = 0;
      this._playBuzz();
    }

    // Wing: dragonflies occasionally
    this._wingTimer += t;
    if (this._wingTimer > 300 && flyingDragonflies > 0) {
      this._wingTimer = 0;
      this._playWing();
    }
  }

  // ── Stress Events ──────────────────────────────────────────────────
  triggerStressEvent() {
    const event = STRESS_EVENTS[randInt(0, STRESS_EVENTS.length - 1)];
    this.activeEvent = { ...event, elapsed: 0 };
    this.stressEventsTotal++;
    this.stressEventLog.unshift({
      time: this.simulationTime,
      name: event.name,
      color: event.color,
      duration: event.duration,
      survived: null,  // null=in-progress, true=ended
      deaths: 0,       // creatures that died during this event
      severity: event.severity,
    });
    if (this.stressEventLog.length > 10) this.stressEventLog.pop();
    // Particles indicating the event start
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(
        rand(POND_X + 20, POND_X + POND_W - 20),
        rand(POND_Y + 20, POND_Y + POND_H - 20),
        event.color,
        { vx: rand(-0.5, 0.5), vy: rand(-1, 0), life: rand(30, 60), size: rand(3, 6), gravity: -0.005 }
      ));
    }
  }

  recordStressDeath() {
    // Find the most recent unmarked log entry and increment its death counter
    for (const entry of this.stressEventLog) {
      if (entry.survived === null) {
        entry.deaths++;
        break;
      }
    }
  }

  processStressEventTick(t) {
    if (!this.activeEvent) return;
    const sev = this.activeEvent.severity;

    // Affect submerged/ground entities
    const damageEntity = (arr) => {
      for (const e of arr) {
        if (!e.alive) continue;
        let resilience = 0.3; // default for non-genome creatures
        if (e.phenotype) {
          resilience = e.phenotype.stressResilience != null ? e.phenotype.stressResilience : 0.3;
        } else if (e.genome) {
          // Fallback: express genome
          const p = e.phenotype || expressGenome(e.genome);
          resilience = p.stressResilience != null ? p.stressResilience : 0.3;
        }
        // Damage scales quadratically with vulnerability
        const vulnerability = (1 - resilience);
        const damage = sev * vulnerability * vulnerability * t;
        if (damage > 0) {
          // Stress drains satiation first, then energy
          if (e.satiation != null) {
            const satDrain = Math.min(e.satiation, damage * 2);
            e.satiation -= satDrain;
          }
          if (e.energy != null) {
            e.energy -= damage;
          }
        }
      }
    };

    damageEntity(this.tadpoles);
    damageEntity(this.froglets);
    damageEntity(this.mosquitoLarvae);
    damageEntity(this.dragonflyNymphs);
    damageEntity(this.frogSpawns);
    damageEntity(this.mosquitoEggs);

    // Flying creatures (dragonflies, mosquitoes) take reduced damage
    if (this.activeEvent.id !== 'drought') {
      for (const m of this.mosquitoes) {
        if (!m.alive) continue;
        m.energy -= sev * 0.3 * t;
      }
      for (const d of this.dragonflies) {
        if (!d.alive) continue;
        d.energy -= sev * 0.2 * t;
      }
    }
  }

  spawnFrogEggs() {
    const edge = randInt(0, 3);
    let x, y;
    switch (edge) {
      case 0: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y - 5; break;
      case 1: x = POND_X + POND_W + 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
      case 2: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y + POND_H + 5; break;
      case 3: x = POND_X - 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
    }
    const genome = sampleGenePool();
    const spawn = new FrogSpawn(x - POND_X, y - POND_Y, genome);
    spawn.x = clamp(x, POND_X + 15, POND_X + POND_W - 15);
    spawn.y = clamp(y, POND_Y + 15, POND_Y + POND_H - 15);
    this.addFrogSpawn(spawn);
    this.ripples.push({ x: spawn.x, y: spawn.y, r: 2, maxR: 35, alpha: 0.5 });
  }

  spawnMosquitoEggs() {
    const x = rand(POND_X + 15, POND_X + POND_W - 15);
    const y = rand(POND_Y + 15, POND_Y + POND_H - 15);
    this.addMosquitoEgg(new MosquitoEggRaft(x, y));
  }

  spawnDragonflyNymph() {
    const edge = randInt(0, 3);
    let x, y;
    switch (edge) {
      case 0: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y - 5; break;
      case 1: x = POND_X + POND_W + 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
      case 2: x = rand(POND_X + 20, POND_X + POND_W - 20); y = POND_Y + POND_H + 5; break;
      case 3: x = POND_X - 5; y = rand(POND_Y + 20, POND_Y + POND_H - 20); break;
    }
    const nymph = new DragonflyNymph(clamp(x, POND_X + 15, POND_X + POND_W - 15), clamp(y, POND_Y + 15, POND_Y + POND_H - 15));
    this.addDragonflyNymph(nymph);
    this.ripples.push({ x: nymph.x, y: nymph.y, r: 2, maxR: 25, alpha: 0.4 });
  }

  updateEntities(arr, dt) { for (const e of arr) { if (e.alive) e.update(dt); } }

  /** Sync old entity positions → ECS components for all entity arrays. */
  _syncAllPositions() {
    if (!ecsWorld) return;
    const arrays = [
      this.food, this.frogSpawns, this.tadpoles, this.froglets,
      this.mosquitoEggs, this.mosquitoLarvae, this.mosquitoes,
      this.dragonflyNymphs, this.dragonflies, this.particles,
    ];
    for (const arr of arrays) {
      for (const e of arr) {
        if (!e.alive || !e._ecsEntityId) continue;
        syncPosition(e._ecsEntityId, e);
      }
    }
  }

  processEating() {
    for (const tad of this.tadpoles) {
      if (!tad.alive) continue;
      for (const f of this.food) {
        if (!f.alive) continue;
        if (f.radius > tad._mouth + 1) continue;
        if (Math.hypot(tad.x - f.x, tad.y - f.y) < tad.radius + f.radius) {
          f.alive = false;
          tad.satiation = Math.min(100, tad.satiation + f.nutrition * (tad._metabolism > 0.8 ? 0.7 : 1.2));
        }
      }
    }
    for (const frog of this.froglets) {
      if (!frog.alive) continue;
      for (const f of this.food) {
        if (!f.alive) continue;
        if (f.radius > frog._mouth + 2) continue;
        if (Math.hypot(frog.x - f.x, frog.y - f.y) < frog.radius + f.radius) {
          f.alive = false;
          frog.satiation = Math.min(100, frog.satiation + f.nutrition * 1.5);
        }
      }
    }
  }

  processMosquitoEating() {
    for (const frog of this.froglets) {
      if (!frog.alive) continue;
      for (const m of this.mosquitoes) {
        if (!m.alive) continue;
        const dy = m.y - frog.y;
        if (dy > -30 && dy < 10 && Math.hypot(frog.x - m.x, frog.y - m.y) < frog.radius + 10) {
          m.alive = false;
          frog.satiation = Math.min(100, frog.satiation + 20);
        }
      }
    }
  }

  processDragonflyEating() {
    for (const n of this.dragonflyNymphs) {
      if (!n.alive) continue;
      if (n._attackCooldown > 0) continue;
      for (const t of this.tadpoles) {
        if (!t.alive) continue;
        if (Math.hypot(n.x - t.x, n.y - t.y) < n.radius + t.radius + 4) {
          t.alive = false;
          n.satiation = Math.min(100, n.satiation + 30);
          n.growth = Math.min(1, n.growth + 0.08);
          n._meals++;
          n._attackCooldown = 20;
          for (let i = 0; i < 4; i++) this.particles.push(new Particle(t.x, t.y, 'hsla(30, 40%, 25%, 0.4)', { vy: rand(0.1, 0.4), life: rand(15, 25), size: rand(1, 2), gravity: 0.01 }));
          break;
        }
      }
      if (n._attackCooldown > 0) continue;
      for (const l of this.mosquitoLarvae) {
        if (!l.alive) continue;
        if (Math.hypot(n.x - l.x, n.y - l.y) < n.radius + l.radius + 3) {
          l.alive = false;
          n.satiation = Math.min(100, n.satiation + 15);
          n.growth = Math.min(1, n.growth + 0.04);
          n._meals++;
          n._attackCooldown = 15;
          break;
        }
      }
    }
  }

  getEntityAt(mx, my) {
    if (mx < 0) return null;
    let best = null, bestD = 15;
    const check = (arr) => {
      for (const e of arr) {
        if (!e.alive) continue;
        const d = Math.hypot(mx - e.x, my - e.y);
        if (d < bestD) { bestD = d; best = e; }
      }
    };
    check(this.frogSpawns); check(this.tadpoles); check(this.froglets);
    check(this.mosquitoEggs); check(this.mosquitoLarvae); check(this.mosquitoes);
    check(this.dragonflyNymphs); check(this.dragonflies);
    check(this.food);  // algae
    return best;
  }

  render() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(350, 350, 50, 350, 350, 450);
    grad.addColorStop(0, '#1a7a8a');
    grad.addColorStop(0.5, '#126a7a');
    grad.addColorStop(1, '#0c4a5a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Bank
    ctx.fillStyle = '#2a3a1a';
    ctx.fillRect(0, 0, this.width, POND_MARGIN);
    ctx.fillRect(0, 0, POND_MARGIN, this.height);
    ctx.fillRect(0, this.height - POND_MARGIN, this.width, POND_MARGIN);
    ctx.fillRect(this.width - POND_MARGIN, 0, POND_MARGIN, this.height);
    ctx.fillStyle = '#4a5a2a';
    ctx.fillRect(0, 0, this.width, 6);
    ctx.fillRect(0, 0, 6, this.height);
    ctx.fillRect(0, this.height - 6, this.width, 6);
    ctx.fillRect(this.width - 6, 0, 6, this.height);

    ctx.fillStyle = 'rgba(10, 50, 70, 0.3)';
    ctx.fillRect(POND_X, POND_Y, POND_W, POND_H);

    // ── Stress Event Overlay ──
    if (this.activeEvent) {
      const ev = this.activeEvent;
      const progress = ev.elapsed / ev.duration; // 0→1
      const pulse = 0.08 + Math.sin(progress * Math.PI * 4) * 0.04;
      // Tint the pond water
      ctx.fillStyle = ev.color.replace(')', `, ${pulse})`).replace(/#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i,
        (m, r, g, b) => `rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)}`);
      ctx.fillRect(POND_X, POND_Y, POND_W, POND_H);
      // Warning banner at top of pond area
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(POND_X, POND_Y, POND_W, 28);
      ctx.fillStyle = ev.color;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠ ' + ev.name + '  [' + Math.ceil(ev.duration - ev.elapsed) + ']', this.width / 2, POND_Y + 14);
      ctx.textBaseline = 'alphabetic';
    }

    // ── Day/Night Overlay ──
    const dayAngle = this.dayCycle * Math.PI * 2;
    const brightness = (Math.cos(dayAngle) + 1) / 2;  // 1=noon, 0=midnight
    const nightAlpha = (1 - brightness) * 0.45;        // max 45% dark at midnight
    if (nightAlpha > 0.01) {
      ctx.fillStyle = `rgba(5, 15, 35, ${nightAlpha})`;
      ctx.fillRect(POND_X, POND_Y, POND_W, POND_H);
    }

    // ── Season Banner (top-right corner) ──
    const seasonIdx = Math.floor(this.seasonCycle * 4);
    const seasonIcon = this.SEASONS[seasonIdx];
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(this.width - 110, POND_Y, 110, 20);
    ctx.fillStyle = this.SEASON_COLORS[seasonIdx];
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(seasonIcon, this.width - 14, POND_Y + 10);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'start';

    // Lily pads
    const now = this.simulationTime;
    for (const lp of this.lilyPads) {
      const sway = Math.sin(now * 0.001 + lp.phase) * 2;
      ctx.save();
      ctx.translate(lp.x + sway, lp.y + sway);
      ctx.beginPath();
      ctx.ellipse(0, 0, lp.r, lp.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2a5a2a';
      ctx.fill();
      ctx.strokeStyle = '#1a4a1a';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lp.r * 0.2, 0);
      ctx.lineTo(lp.r * 0.6, -lp.r * 0.5);
      ctx.lineTo(lp.r * 0.6, lp.r * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#0d5a6a';
      ctx.fill();
      ctx.restore();
    }

    // Ripples
    for (const r of this.ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150, 220, 240, ${r.alpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Food (algae)
    for (const f of this.food) {
      const alpha = Math.min(1, (f.maxAge - f.age) / 100);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80, 190, 60, ${alpha * 0.8})`;
      ctx.fill();
      ctx.fillStyle = `rgba(120, 230, 80, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(f.x - f.radius * 0.2, f.y - f.radius * 0.2, f.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mosquito eggs
    for (const e of this.mosquitoEggs) {
      ctx.fillStyle = '#2a2a1a';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a0a';
      for (let i = 0; i < e.eggCount && i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 1.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mosquito larvae
    for (const l of this.mosquitoLarvae) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(Math.sin(l.phase) * 0.3);
      ctx.fillStyle = '#3a3a2a';
      ctx.beginPath();
      ctx.ellipse(0, 0, l.radius, l.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a4a3a';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(l.radius * 1.5, Math.sin(l.phase * 2) * 3, l.radius * 2.5, Math.sin(l.phase * 3) * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Frog spawn
    for (const s of this.frogSpawns) {
      const morph = assignMorph(s.genome);
      const eggColor = `hsla(${morph.hue}, 25%, 88%, 0.6)`;
      const eggBorder = `hsla(${morph.hue}, 20%, 75%, 0.4)`;
      for (const c of s.cluster) {
        ctx.beginPath();
        ctx.arc(s.x + c.ox, s.y + c.oy, c.r, 0, Math.PI * 2);
        ctx.fillStyle = eggColor;
        ctx.fill();
        ctx.strokeStyle = eggBorder;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x + c.ox - 1, s.y + c.oy - 1, c.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(200, 20%, 15%, 0.6)';
        ctx.fill();
      }
    }

    // Tadpoles
    for (const t of this.tadpoles) {
      const morph = assignMorph(t.genome);
      const h = morph.hue;
      const s = morph.sat;
      const bodyR = t.radius;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(Math.atan2(t.vy, t.vx));
      ctx.strokeStyle = `hsla(${h}, ${s}%, 40%, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.3, 0);
      ctx.quadraticCurveTo(-bodyR, Math.sin(t.wobble) * 3, -bodyR - t.tailLength, Math.sin(t.wobble * 1.5) * 2);
      ctx.stroke();
      ctx.fillStyle = `hsla(${h}, ${s}%, 45%, 0.8)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyR, bodyR * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(bodyR * 0.3, -bodyR * 0.2, 1.2, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.3, bodyR * 0.2, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(bodyR * 0.35, -bodyR * 0.25, 0.5, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.35, bodyR * 0.15, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${h}, ${s - 20}%, 55%, 0.3)`;
      ctx.beginPath();
      ctx.ellipse(0, bodyR * 0.2, bodyR * 0.5, bodyR * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Froglets
    for (const f of this.froglets) {
      const morph = assignMorph(f.genome);
      const h = morph.hue;
      const s = morph.sat;
      const bodyR = f.radius;
      ctx.save();
      ctx.translate(f.x, f.y);
      const angle = Math.atan2(f.vy, f.vx);
      const jumpPhase = f.jumpCooldown > 0 ? Math.sin(f.jumpCooldown * 0.3) * 0.2 : 0;
      ctx.rotate(angle + jumpPhase);
      ctx.strokeStyle = `hsla(${h}, ${s}%, 30%, 0.7)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.2, -bodyR * 0.3); ctx.lineTo(-bodyR * 0.7, -bodyR * 0.7); ctx.lineTo(-bodyR * 0.5, -bodyR * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.2, bodyR * 0.3); ctx.lineTo(-bodyR * 0.7, bodyR * 0.7); ctx.lineTo(-bodyR * 0.5, bodyR * 0.3);
      ctx.stroke();
      ctx.fillStyle = `hsla(${h}, ${s + 5}%, 40%, 0.9)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyR, bodyR * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${(h + 20) % 360}, ${s - 15}%, 25%, 0.4)`;
      ctx.beginPath();
      ctx.arc(bodyR * 0.2, -bodyR * 0.15, bodyR * 0.2, 0, Math.PI * 2);
      ctx.arc(-bodyR * 0.15, bodyR * 0.2, bodyR * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(bodyR * 0.6, -bodyR * 0.25, 1.8, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.6, bodyR * 0.25, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c8e040';
      ctx.beginPath();
      ctx.arc(bodyR * 0.65, -bodyR * 0.3, 1, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.65, bodyR * 0.2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `hsla(${h}, ${s}%, 30%, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bodyR * 0.5, -bodyR * 0.4); ctx.lineTo(bodyR * 0.9, -bodyR * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bodyR * 0.5, bodyR * 0.4); ctx.lineTo(bodyR * 0.9, bodyR * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Adult mosquitoes
    for (const m of this.mosquitoes) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.atan2(m.vy, m.vx));
      ctx.fillStyle = 'rgba(180, 200, 220, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, -3, 4, 1.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 3, 4, 1.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(2.5, 0, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(3.5, 0); ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Dragonfly nymphs (submerged predators)
    for (const n of this.dragonflyNymphs) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(Math.atan2(n.vy, n.vx));
      const bodyR = n.radius;
      ctx.fillStyle = '#3a4a3a';
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyR, bodyR * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a3a2a';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-bodyR * 0.4 * i, 0, bodyR * 0.35, bodyR * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#4a6a3a';
      ctx.beginPath();
      ctx.arc(bodyR * 0.5, -bodyR * 0.3, 1.5, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.5, bodyR * 0.3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8aca5a';
      ctx.beginPath();
      ctx.arc(bodyR * 0.55, -bodyR * 0.35, 0.7, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.55, bodyR * 0.25, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Adult dragonflies (flying)
    for (const d of this.dragonflies) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(Math.atan2(d.vy, d.vx) + Math.sin(d._wingAngle * 2) * 0.1);
      const bodyR = d.radius;
      const wings = 0.5 + Math.sin(d._wingAngle) * 0.5;
      ctx.fillStyle = `rgba(160, 200, 230, ${0.2 + wings * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(1, -bodyR * 1.5, bodyR * 1.2, bodyR * 0.3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(1, bodyR * 1.5, bodyR * 1.2, bodyR * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a7a4a';
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyR, bodyR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath();
      ctx.ellipse(bodyR * 0.5, 0, bodyR * 0.3, bodyR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6aaa4a';
      ctx.beginPath();
      ctx.arc(bodyR * 0.7, -bodyR * 0.2, 0.8, 0, Math.PI * 2);
      ctx.arc(bodyR * 0.7, bodyR * 0.2, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles (death/leaving effects)
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Hover tooltip
    if (this.hoveredEntity) this.drawTooltip(ctx, this.hoveredEntity);

    // ── Debug AI Overlay (toggle with D key) ──
    if (this.debugMode) {
      // Tadpoles: sight range + target lines
      for (const t of this.tadpoles) {
        if (!t.alive) continue;
        // Sight range circle
        ctx.beginPath();
        ctx.arc(t.x, t.y, t._sight, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 220, 255, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 220, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Find nearest target (replicating tadpole logic for display)
        let nearest = null, bestD = t._sight;
        for (const f of this.food) {
          if (!f.alive || f.radius > t._mouth + 1) continue;
          const d = Math.hypot(t.x - f.x, t.y - f.y);
          if (d < bestD) { bestD = d; nearest = f; }
        }
        if (nearest) {
          // Draw line to target
          ctx.beginPath();
          ctx.moveTo(t.x, t.y);
          ctx.lineTo(nearest.x, nearest.y);
          ctx.strokeStyle = 'rgba(100, 255, 150, 0.2)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          // Highlight target
          ctx.beginPath();
          ctx.arc(nearest.x, nearest.y, nearest.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(100, 255, 150, 0.4)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // State label
        ctx.fillStyle = 'rgba(100, 220, 255, 0.35)';
        ctx.font = '8px system-ui, sans-serif';
        const stateLabel = nearest ? '→ FOOD' : '↻ WANDER';
        const stateColor = nearest ? 'rgba(100,255,150,0.5)' : 'rgba(255,200,100,0.4)';
        ctx.fillStyle = stateColor;
        ctx.fillText(stateLabel + ' sat:' + t.satiation.toFixed(0), t.x + t.radius + 4, t.y + 3);
      }

      // Froglets: sight range + target lines
      for (const f of this.froglets) {
        if (!f.alive) continue;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f._sight, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 100, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        let nearest = null, bestD = f._sight;
        for (const fd of this.food) {
          if (!fd.alive || fd.radius > f._mouth + 2) continue;
          const d = Math.hypot(f.x - fd.x, f.y - fd.y);
          if (d < bestD) { bestD = d; nearest = fd; }
        }
        if (nearest) {
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(nearest.x, nearest.y);
          ctx.strokeStyle = 'rgba(255, 200, 100, 0.2)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 200, 100, 0.4)';
        ctx.font = '8px system-ui, sans-serif';
        ctx.fillText('sat:' + f.satiation.toFixed(0), f.x + f.radius + 4, f.y + 3);
      }

      // Dragonfly nymphs: sight range + prey pursuit
      for (const n of this.dragonflyNymphs) {
        if (!n.alive) continue;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n._sight, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 80, 80, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        let nearest = null, bestD = n._sight;
        for (const t of this.tadpoles) {
          if (!t.alive) continue;
          const d = Math.hypot(n.x - t.x, n.y - t.y);
          if (d < bestD) { bestD = d; nearest = t; }
        }
        if (!nearest) {
          for (const l of this.mosquitoLarvae) {
            if (!l.alive) continue;
            const d = Math.hypot(n.x - l.x, n.y - l.y);
            if (d < bestD) { bestD = d; nearest = l; }
          }
        }
        if (nearest) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(nearest.x, nearest.y);
          ctx.strokeStyle = n._attackCooldown > 0 ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255, 0, 0, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        const cdStatus = n._attackCooldown > 0 ? 'CD:' + n._attackCooldown.toFixed(0) : 'READY';
        ctx.fillStyle = n._attackCooldown > 0 ? 'rgba(255,100,100,0.5)' : 'rgba(255,80,80,0.4)';
        ctx.font = '8px system-ui, sans-serif';
        ctx.fillText(cdStatus, n.x + n.radius + 4, n.y + 3);
      }

      // Debug mode indicator
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(4, 4, 120, 18);
      ctx.fillStyle = '#22d3ee';
      ctx.font = '9px system-ui, sans-serif';
      ctx.fillText('🔍 DEBUG MODE [D]', 10, 16);
    }
  }

  drawTooltip(ctx, entity) {
    let name = 'Unknown', genome = null;
    const sp = entity.species;
    if (sp === 'frogSpawn') { name = '🐸 Frog Spawn'; genome = entity.genome; }
    else if (sp === 'tadpole') { name = ' Tadpole'; genome = entity.genome; }
    else if (sp === 'froglet') { name = '🐸 Froglet'; genome = entity.genome; }
    else if (sp === 'mosquitoEgg') { name = ' Mosquito Eggs'; }
    else if (sp === 'mosquitoLarva') { name = ' Mosquito Larva'; }
    else if (sp === 'mosquito') { name = '🦟 Mosquito'; genome = entity.genome; }
    else if (sp === 'dragonflyNymph') { name = '🐉 Dragonfly Nymph'; genome = entity.genome; }
    else if (sp === 'dragonflyAdult') { name = '🐉 Dragonfly'; genome = entity.genome; }
    else if (sp === 'food') { name = '🌿 Algae'; genome = entity.genome; }

    const tx = Math.min(entity.x + 15, this.width - 200);
    const ty = Math.max(entity.y - 20, 10);

    const isFrog = sp === 'frogSpawn' || sp === 'tadpole' || sp === 'froglet';
    const tooltipH = genome ? (isFrog ? 255 : 155) : 50;
    ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
    ctx.fillRect(tx, ty, 190, tooltipH);
    ctx.strokeStyle = 'rgba(60, 180, 200, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx, ty, 190, tooltipH);

    ctx.fillStyle = '#c0d8e0';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(name, tx + 8, ty + 14);

    if (genome) {
      ctx.fillStyle = '#5a9aaa';
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillText('GENOTYPE (regulatory genes)', tx + 6, ty + 28);
      ctx.font = '9px system-ui, sans-serif';
      let line = 36;
      for (const k of REGULATORY_GENES) {
        const v = genome[k];
        ctx.fillStyle = '#5a7a8a';
        ctx.fillText(k, tx + 6, ty + line);
        ctx.fillStyle = `hsl(${v * 120 + 40}, 60%, 50%)`;
        ctx.fillRect(tx + 80, ty + line - 7, v * 50, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(tx + 80, ty + line - 7, 50, 1);
        ctx.fillStyle = '#8aacba';
        ctx.fillText(v.toFixed(2), tx + 135, ty + line);
        line += 13;
      }
      // Species-specific effective traits
      line += 2;
      ctx.fillStyle = '#7abaaa';
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillText('EFFECTIVE TRAITS', tx + 6, ty + line);
      ctx.font = '9px system-ui, sans-serif';
      line += 12;
      if (isFrog) {
        const p = expressGenome(genome);
        for (const k of PHENOTYPE_KEYS) {
          const v = p[k];
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
          ctx.fillStyle = '#5a7a8a';
          ctx.fillText(label, tx + 6, ty + line);
          const barColor = k === 'stressResilience' ? `hsl(${v * 50 + 80}, 70%, 50%)` : `hsl(${v * 120}, 70%, 50%)`;
          ctx.fillStyle = barColor;
          ctx.fillRect(tx + 100, ty + line - 7, v * 50, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(tx + 100, ty + line - 7, 50, 1);
          ctx.fillStyle = '#8aacba';
          ctx.fillText(v.toFixed(2), tx + 155, ty + line);
          line += 12;
        }
      } else if (sp === 'mosquito') {
        const eff = [
          `Speed:     ${entity._speed.toFixed(2)}`,
          `Lifespan:  ${entity.life.toFixed(0)} ticks`,
          `Altitude:  ${entity.altitude.toFixed(1)}`,
        ];
        for (const e of eff) { ctx.fillStyle = '#6a8a7a'; ctx.fillText(e, tx + 6, ty + line); line += 12; }
      } else if (sp === 'dragonflyNymph') {
        const eff = [
          `Speed:     ${entity._speed.toFixed(2)}`,
          `Sight:     ${entity._sight.toFixed(0)}px`,
          `Atk CD:    ${entity._attackCooldown.toFixed(0)} ticks`,
          `Meals:     ${entity._meals}`,
        ];
        for (const e of eff) { ctx.fillStyle = '#6a8a7a'; ctx.fillText(e, tx + 6, ty + line); line += 12; }
      } else if (sp === 'dragonflyAdult') {
        const eff = [
          `Speed:     ${entity._speed.toFixed(2)}`,
          `Lifespan:  ${entity.life.toFixed(0)} ticks`,
        ];
        for (const e of eff) { ctx.fillStyle = '#6a8a7a'; ctx.fillText(e, tx + 6, ty + line); line += 12; }
      } else if (sp === 'food') {
        const eff = [
          `Size:      ${entity.radius.toFixed(1)}px`,
          `Nutrition: ${entity.nutrition.toFixed(1)}`,
          `Lifespan:  ${entity.maxAge.toFixed(0)} ticks`,
        ];
        for (const e of eff) { ctx.fillStyle = '#6a8a7a'; ctx.fillText(e, tx + 6, ty + line); line += 12; }
      }
    }
  }

  recordGenerationData() {
    const hof = getHallOfFame(1);
    const topGenome = hof.length > 0 ? hof[0] : null;
    const record = {
      generation: this.generation,
      time: this.simulationTime,
      frogsReleased: this.frogsReleased,
      tadpoles: this.tadpoles.filter(e => e.alive).length,
      froglets: this.froglets.filter(e => e.alive).length,
      humansBitten: this.humansBitten,
      topOffspring: topGenome ? topGenome._offspring : 0,
      topGenomeId: topGenome ? topGenome._id : 0,
      stressEvents: this.stressEventsTotal,
      morphDiversity: morphDiversity(genePool),
    };
    // Average regulatory genes from gene pool
    if (genePool.length > 0) {
      REGULATORY_GENES.forEach(k => {
        record[k] = genePool.reduce((s, g) => s + g[k], 0) / genePool.length;
      });
    } else {
      REGULATORY_GENES.forEach(k => { record[k] = 0; });
    }
    this.generationData.push(record);
    this.hallOfFame = getHallOfFame(5);
  }

  getHallOfFame() {
    return this.hallOfFame;
  }

  getCSV() {
    const headers = ['generation', 'time', 'frogsReleased', 'tadpoles', 'froglets', 'humansBitten', 'topOffspring', 'topGenomeId', 'stressEvents', 'morphDiversity', ...REGULATORY_GENES];
    const rows = this.generationData.map(r =>
      headers.map(h => r[h] !== undefined ? r[h] : '').join(',')
    );
    return headers.join(',') + '\n' + rows.join('\n');
  }

  getStats() {
    const seasonIdx = Math.floor(this.seasonCycle * 4);
    const dayAngle = this.dayCycle * Math.PI * 2;
    const brightness = (Math.cos(dayAngle) + 1) / 2;
    const timeStr = brightness > 0.6 ? '☀️ Day' : brightness > 0.3 ? '🌅 Dusk/Dawn' : '🌙 Night';
    return {
      frogSpawns: this.frogSpawns.length,
      tadpoles: this.tadpoles.length,
      froglets: this.froglets.length,
      frogsReleased: this.frogsReleased,
      mosquitoEggs: this.mosquitoEggs.length,
      mosquitoLarvae: this.mosquitoLarvae.length,
      mosquitoes: this.mosquitoes.length,
      mosquitoesReleased: this.mosquitoesReleased,
      humansBitten: this.humansBitten,
      dragonflyNymphs: this.dragonflyNymphs.length,
      dragonflies: this.dragonflies.length,
      dragonfliesBirthed: this.dragonfliesBirthed,
      dragonfliesReleased: this.dragonfliesReleased,
      food: this.food.length,
      generation: this.generation,
      totalSpawnLaid: this.totalSpawnLaid,
      time: this.simulationTime,
      stressEventActive: this._ecsStressSystem ?
        (this._ecsStressSystem.activeEvent ? this._ecsStressSystem.activeEvent.name : null)
        : (this.activeEvent ? this.activeEvent.name : null),
      stressEventsTotal: this._ecsStressSystem ? this._ecsStressSystem.eventsTotal : this.stressEventsTotal,
      stressEventLog: this._ecsStressSystem ?
        this._ecsStressSystem.eventLog.slice(0, 6)
        : this.stressEventLog.slice(0, 6),  // last 6 for UI
      season: this.SEASONS[seasonIdx],
      seasonColor: this.SEASON_COLORS[seasonIdx],
      timeOfDay: timeStr,
      brightness: brightness,
      morphClusters: this.currentMorphs,
      morphDiversity: morphDiversity(genePool),
      hasSpeciation: this.morphLineage.hasSpeciation(),
      activeMorphCount: this.morphLineage.getActiveClusterCount(),
      morphSplits: this.morphLineage.splits,
    };
  }

  getEvoStats() {
    const avg = {};
    if (genePool.length === 0) return null;
    REGULATORY_GENES.forEach(k => { avg[k] = genePool.reduce((s, g) => s + g[k], 0) / genePool.length; });
    return avg;
  }

  reset() {
    this.food = []; this.frogSpawns = []; this.tadpoles = []; this.froglets = [];
    this.mosquitoEggs = []; this.mosquitoLarvae = []; this.mosquitoes = []; this.particles = [];
    this.dragonflyNymphs = []; this.dragonflies = [];
    this.frogsReleased = 0; this.mosquitoesReleased = 0; this.humansBitten = 0;
    this.dragonfliesReleased = 0; this.dragonfliesBirthed = 0;
    this.totalSpawnLaid = 0; this.generation = 0; this.simulationTime = 0;
    this.generationData = []; this._lastRecordedGen = -1;
    this.hallOfFame = [];
    this.activeEvent = null; this.stressTimer = 0; this.stressEventsTotal = 0; this.stressEventsSurvived = 0;
    this.seasonCycle = 0.25; this.dayCycle = 0.5;
    this.frogTimer = 0; this.mosquitoTimer = 0; this.algaeTimer = 0; this.dragonflyTimer = 0;
    this.ripples = [];
    this.stressEventLog = [];
    // Clear gene pools
    resetPool();
    mosquitoGenePool.length = 0;
    dragonflyGenePool.length = 0;
    algaeGenePool.length = 0;
    this.morphLineage.reset();
    this.currentMorphs = [];
    // Reset ECS world
    resetEcsWorld();
    this.seed();
  }
}