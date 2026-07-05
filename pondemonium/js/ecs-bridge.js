// ── ECS Bridge (Phase 3) ────────────────────────────────────────────
// Syncs ECS simulation data into the pond's rendering arrays.
// The pond keeps render() as-is — this bridge populates its arrays
// with position/radius/color data from ECS components.
// Old entity classes are deleted — ECS is the only simulation path now.

import { Position, Renderable, Species, Growth, Energy, Animation, Steering, TargetSeek,
         Jump, Flight, Genome, Age, Mouth, Nutrition, LifeLimited, ParticleState } from './index.js';

const POND_X = 20, POND_Y = 20, POND_W = 660, POND_H = 660;

/**
 * Sync all ECS entities into the pond's rendering arrays.
 * Call after ecsWorld.update() and before pond.render().
 * Creates lightweight render proxies (position + appearance only, no update logic).
 */
export function syncEcsToPond(pond, ecsWorld) {
  if (!ecsWorld) return;

  // Clear old rendering arrays
  pond.frogSpawns = [];
  pond.tadpoles = [];
  pond.froglets = [];
  pond.mosquitoEggs = [];
  pond.mosquitoLarvae = [];
  pond.mosquitoes = [];
  pond.dragonflyNymphs = [];
  pond.dragonflies = [];
  pond.food = [];
  pond.particles = [];

  // Iterator helper: for each entity with ALL specified components, call fn(entityId, components)
  const forEach = (storeNames, fn) => {
    const tuples = ecsWorld.queryData(...storeNames);
    for (const t of tuples) fn(t);
  };

  // ── Food (Algae) ──
  forEach(['Position', 'Species', 'Nutrition'], (t) => {
    if (t.Species.type !== 'food') return;
    pond.food.push(renderProxy(t));
  });

  // ── Frog Spawn ──
  forEach(['Position', 'Species'], (t) => {
    if (t.Species.type !== 'frogSpawn') return;
    pond.frogSpawns.push(renderProxy(t));
  });

  // ── Tadpoles ──
  forEach(['Position', 'Species', 'Energy', 'Growth', 'Animation', 'Steering'], (t) => {
    if (t.Species.type !== 'tadpole') return;
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render._maxSize = t.Growth.maxSize;
    render.tailLength = lerp(14, 4, render.growth * 1.2);
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    pond.tadpoles.push(render);
  });

  // ── Froglets ──
  forEach(['Position', 'Species', 'Energy', 'Growth', 'Animation', 'Steering', 'Jump'], (t) => {
    if (t.Species.type !== 'froglet') return;
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render._maxSize = t.Growth.maxSize;
    render.legLength = lerp(8, 16, render.growth);
    render.phase = t.Animation.phase;
    render.jumpCooldown = t.Jump.cooldown;
    pond.froglets.push(render);
  });

  // ── Mosquito Eggs ──
  forEach(['Position', 'Species'], (t) => {
    if (t.Species.type !== 'mosquitoEgg') return;
    pond.mosquitoEggs.push(renderProxy(t));
  });

  // ── Mosquito Larvae ──
  forEach(['Position', 'Species', 'Animation'], (t) => {
    if (t.Species.type !== 'mosquitoLarva') return;
    const render = renderProxy(t);
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    pond.mosquitoLarvae.push(render);
  });

  // ── Mosquitoes (flying) ──
  forEach(['Position', 'Species', 'Animation', 'Flight'], (t) => {
    if (t.Species.type !== 'mosquito') return;
    const render = renderProxy(t);
    render.phase = t.Animation.phase;
    render.flightY = t.Position.flightY !== undefined ? t.Position.flightY : t.Position.y;
    render.altitude = t.Flight.altitude;
    pond.mosquitoes.push(render);
  });

  // ── Dragonfly Nymphs ──
  forEach(['Position', 'Species', 'Energy', 'Growth', 'Animation'], (t) => {
    if (t.Species.type !== 'dragonflyNymph') return;
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    render._meals = t.Predator ? t.Predator.meals : 0;
    pond.dragonflyNymphs.push(render);
  });

  // ── Dragonfly Adults ──
  forEach(['Position', 'Species', 'Animation', 'Flight'], (t) => {
    if (t.Species.type !== 'dragonflyAdult') return;
    const render = renderProxy(t);
    render.phase = t.Animation.phase;
    render.flightY = t.Position.flightY !== undefined ? t.Position.flightY : t.Position.y;
    render.altitude = t.Flight.altitude;
    pond.dragonflies.push(render);
  });

  // ── Particles ──
  forEach(['Position', 'Species', 'ParticleState'], (t) => {
    if (t.Species.type !== 'particle') return;
    const pos = t.Position;
    const ps = t.ParticleState;
    pond.particles.push({
      x: pos.x,
      y: pos.y,
      vx: pos.vx || 0,
      vy: pos.vy || 0,
      color: ps.color || t.Renderable?.color || '#88cc44',
      size: ps.size || 3,
      life: ps.life || 0,
      maxLife: ps.maxLife || ps.life || 30,
      radius: t.Renderable?.radius || ps.size || 3,
      alive: (ps.life || 0) > 0,
      species: 'particle',
    });
  });
}

/**
 * Create a lightweight render proxy from ECS component data.
 * Has position, radius, color, alive flag — enough for pond.render().
 * Includes genome and species-specific fields for tooltip display.
 */
function renderProxy(t) {
  const pos = t.Position;
  const rend = t.Renderable || { radius: 4, color: '#88cc44', alpha: 1.0 };
  const species = t.Species || { type: 'unknown' };
  const energy = t.Energy || {};
  const steer = t.Steering || {};
  const growth = t.Growth || {};
  const mouth = t.Mouth || {};
  const age = t.Age || {};
  const genome = t.Genome || null;
  const flight = t.Flight || {};
  const predator = t.Predator || {};
  const limited = t.LifeLimited || {};

  const proxy = {
    x: pos.x,
    y: pos.y,
    vx: pos.vx || 0,
    vy: pos.vy || 0,
    radius: rend.radius,
    color: rend.color,
    alive: true,
    energy: energy.energy !== undefined ? energy.energy : 100,
    maxEnergy: energy.maxEnergy || 100,
    satiation: energy.satiation !== undefined ? energy.satiation : 100,
    species: species.type,
    _ecsEntityId: t.entityId,
  };

  // Attach genome for tooltip display
  if (genome) {
    proxy.genome = genome.genotype;
    proxy.phenotype = genome.phenotype;
  }

  // Steering properties (speed, sight) for moving entities
  if (steer.speed !== undefined) proxy._speed = steer.speed;
  if (steer.sight !== undefined) proxy._sight = steer.sight;

  // Mouth (gape) for feeding entities
  if (mouth.gape !== undefined) proxy._mouth = mouth.gape;

  // Growth tracking
  if (growth.growth !== undefined) proxy.growth = growth.growth;

  // Age / lifespan
  if (age.maxAge !== undefined && age.maxAge !== Infinity) proxy.maxAge = age.maxAge;

  // Flight
  if (flight.altitude !== undefined) proxy.altitude = flight.altitude;
  if (flight.wingAngle !== undefined) proxy._wingAngle = flight.wingAngle;

  // Predator
  if (predator.attackCooldown !== undefined) proxy._attackCooldown = predator.attackCooldown;
  if (predator.meals !== undefined) proxy._meals = predator.meals;

  // Life-limited (mosquito, dragonfly adult)
  if (limited.lifespan !== undefined) proxy.life = limited.lifespan;

  // Nutrition (food)
  if (t.Nutrition && t.Nutrition.value !== undefined) proxy.nutrition = t.Nutrition.value;

  return proxy;
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
