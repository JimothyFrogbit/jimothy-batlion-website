// ── ECS Bridge (Phase 3) ────────────────────────────────────────────
// Syncs ECS simulation data into the pond's rendering arrays.
// The pond keeps render() as-is — this bridge populates its arrays
// with position/radius/color data from ECS components.
// Old entity classes are deleted — ECS is the only simulation path now.

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

  // Iterator helper: for each entity of a species, call fn(tuple) with
  // EVERY component that entity actually has — see EcsWorld.queryBySpecies.
  // This is deliberately NOT a hand-picked component list per species:
  // that pattern silently produced blank tooltips and a tooltip crash
  // three separate times (missing Age, Genome, then Steering/Mouth/
  // Predator/LifeLimited) before it was replaced with this.
  const forEach = (speciesType, fn) => {
    for (const t of ecsWorld.queryBySpecies(speciesType)) fn(t);
  };

  // ── Food (Algae) ──
  forEach('food', (t) => {
    const render = renderProxy(t);
    render.radius = lerp(4, 8, (t.Nutrition?.value || 5) / 10);
    render.maxAge = t.Age?.maxAge || 300;
    pond.food.push(render);
  });

  // ── Frog Spawn ──
  forEach('frogSpawn', (t) => {
    const render = renderProxy(t);
    render.radius = 6;
    // Generate a small egg cluster for rendering (consistent per entityId)
    const seed = t.entityId % 100;
    const n = 3 + (seed % 4);
    render.cluster = [];
    for (let i = 0; i < n; i++) {
      render.cluster.push({ ox: (seed * 3 + i * 7) % 13 - 6, oy: (seed * 7 + i * 5) % 9 - 4, r: 2.5 + (i % 3) * 0.5 });
    }
    pond.frogSpawns.push(render);
  });

  // ── Tadpoles ──
  forEach('tadpole', (t) => {
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render._maxSize = t.Growth.maxSize;
    render.radius = lerp(4, render._maxSize, render.growth);
    render.tailLength = lerp(14, 4, render.growth * 1.2);
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    pond.tadpoles.push(render);
  });

  // ── Froglets ──
  forEach('froglet', (t) => {
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render._maxSize = t.Growth.maxSize;
    render.radius = lerp(10, render._maxSize, render.growth);
    render.legLength = lerp(8, 16, render.growth);
    render.phase = t.Animation.phase;
    render.jumpCooldown = t.Jump.cooldown;
    pond.froglets.push(render);
  });

  // ── Mosquito Eggs ──
  forEach('mosquitoEgg', (t) => {
    const render = renderProxy(t);
    render.radius = 3;
    pond.mosquitoEggs.push(render);
  });

  // ── Mosquito Larvae ──
  forEach('mosquitoLarva', (t) => {
    const render = renderProxy(t);
    render.radius = lerp(2, 5, t.Growth?.growth || 0);
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    pond.mosquitoLarvae.push(render);
  });

  // ── Mosquitoes (flying) ──
  forEach('mosquito', (t) => {
    const render = renderProxy(t);
    render.radius = 3;
    render.phase = t.Animation.phase;
    render.flightY = t.Position.flightY !== undefined ? t.Position.flightY : t.Position.y;
    render.altitude = t.Flight.altitude;
    pond.mosquitoes.push(render);
  });

  // ── Dragonfly Nymphs ──
  forEach('dragonflyNymph', (t) => {
    const render = renderProxy(t);
    render.growth = t.Growth.growth;
    render.radius = lerp(9, 14, render.growth);
    render.phase = t.Animation.phase;
    render.wobble = t.Animation.wobble;
    pond.dragonflyNymphs.push(render);
  });

  // ── Dragonfly Adults ──
  forEach('dragonflyAdult', (t) => {
    const render = renderProxy(t);
    render.radius = 12;
    render.phase = t.Animation.phase;
    render.flightY = t.Position.flightY !== undefined ? t.Position.flightY : t.Position.y;
    render.altitude = t.Flight.altitude;
    pond.dragonflies.push(render);
  });

  // ── Particles ──
  forEach('particle', (t) => {
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
  const genomeData = t.Genome || null;
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
    genome: genomeData ? genomeData.genotype : null,
    _ecsEntityId: t.entityId,
  };

  // Steering properties (speed, sight) for moving entities
  if (steer.speed !== undefined) proxy._speed = steer.speed;
  if (steer.sight !== undefined) proxy._sight = steer.sight;

  // Mouth (gape) for feeding entities
  if (mouth.gape !== undefined) proxy._mouth = mouth.gape;

  // Growth tracking
  if (growth.growth !== undefined) proxy.growth = growth.growth;

  // Age / lifespan
  proxy.age = age.age !== undefined ? age.age : 0;
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
