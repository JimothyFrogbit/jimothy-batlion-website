# Pondemonium — Agent Operating Manual

## Structure
```
index.html              ← minimal shell, <script type="module" src="js/main.js">
js/
  main.js               ← game loop: ecsWorld.update() + reapDead() per sub-step, then
                           syncEcsToPond() + pond.render() once per frame
  registry.js           ← export let pond = null + registerPond(p)  ← breaks circular imports
  utils.js              ← rand, randInt, lerp, clamp(v, lo=0, hi=1), dist, rndChoice
  genome.js             ← REGULATORY_GENES, PHENOTYPE_KEYS, genotypeToPhenotype, expressGenome,
                           breedGenotype, genePool + per-species pools, sample*GenePool()
  pond.js               ← Pond class: render(), tooltip, stats, reset — NO simulation logic,
                           that all lives in ECS systems now
  ecs-bridge.js          ← syncEcsToPond(): queries ECS component stores, populates
                           pond.tadpoles[] etc. with lightweight render proxies
  ui.js                 ← slider handlers, stats/evo display, hover info
  ecs/
    engine.js            ← EcsWorld, ComponentStore, EcsSystem base class
    components.js        ← component factories (Position, Growth, Energy, ...) + registry
    factories.js          ← createFood()/createTadpole() — shared entity-creation logic used
                           by ReproductionSystem, HatchSystem, and Pond.seed()
    adapter.js            ← initEcs()/resetEcsWorld() — owns the global ecsWorld instance
    systems.js            ← registerAllSystems() — the tick order; READ THE COMMENT AT THE
                           TOP before reordering, several systems depend on same-tick freshness
    systems/*.js          ← one file per system; *.test.js are per-system unit tests
    integration.test.js   ← full-pipeline smoke test — run this after touching systems.js
                           or any system's component requirements
```

**There is no legacy entity-class system anymore.** ECS is the only simulation path.
(An earlier per-entity-class architecture — `js/entities/*.js`, `js/entity.js` — was fully
removed once the ECS conversion was complete and verified; see git history if you need the
original per-entity `update()` logic as a reference for porting behaviour.)

## Critical Rules

1. **clamp(value) MUST have defaults:** `clamp(v, lo=0, hi=1)` — single-arg clamp without defaults returns NaN
2. **NaN hatchTimer = permanent spawn:** NaN hatchTimer never satisfies `<= 0`, NaN progress breaks rendering → invisible spawn
3. **Genome traits require expressGenome():** a component's `Genome.genotype` only has the
   6 regulatory gene names (POU1F1, THR, MC1R, IGF1, LEP, NR3C1). Never read phenotype-named
   keys (`bodySize`, `swimSpeed`, ...) directly off a genotype object — they don't exist there
   and silently return `undefined`. Call `expressGenome(genotype)` first to get real values.
   (This exact mistake — reading `genotype.bodySize` instead of `expressGenome(genotype).bodySize`
   — once made every tadpole/froglet in the sim behave identically regardless of genome.)
4. **System order in `ecs/systems.js` is load-bearing** — read the comment block at the top of
   that file before adding/reordering a system. AgeSystem before anything that gates on
   `Age.age`; GrowthSystem before MorphSystem; etc.
5. **Every new species-specific behaviour needs a case in ~5 places**, and it's easy to
   silently miss one (no error — the creature just doesn't do that thing): `SteeringSystem`'s
   switch, `GrowthSystem`'s `GROWTH_CONFIG`, `AnimationSystem`'s rate tables, `ecs-bridge.js`'s
   per-species `forEach` component list, and wherever the entity is first created
   (`ReproductionSystem`/`HatchSystem`/`MorphSystem`). After adding a species, run
   `node js/ecs/integration.test.js` and manually verify it moves/renders/has genome data.
6. **Live file, not backup:** always re-read live files before refactoring — cron jobs patch them
7. **Always add to arcade.html + update banner count** when adding new game pages

## Debug Mode

Toggle with **D** key. Renders AI decision overlay in `render()` after hover tooltip. Shows sight range circles, target lines, and state labels for tadpoles, froglets, and dragonfly nymphs. `this.debugMode` boolean on Pond class. Keyboard handler registered in constructor.

## Audio System

Procedural Web Audio API sounds. Pond class has `initAudio()`, `_playCroak()`, `_playBuzz()`, `_playWing()`, and `updateAudio(t)` called at end of `update()`. Audio context unlocked on first click/pause/key via `pond.initAudio()` calls wired in ui.js and pond.js event handlers. Entity counts for triggering sounds are read directly from ECS component stores (see `updateAudio()`).

Sound frequencies scale with population (well-fed froglets = more croaks, more mosquitoes = more buzz). All procedural — no audio files.

## Adding a Species/Lifecycle Stage Checklist
1. Add component factory calls in whichever system creates it (`ReproductionSystem` for a new
   spawn source, `HatchSystem`/`MorphSystem` for a new lifecycle transition) — consider adding
   a shared factory in `ecs/factories.js` if more than one system creates this species.
2. If it moves: add a case to `SteeringSystem`'s switch (or it will have zero velocity forever).
3. If it grows: add an entry to `GrowthSystem`'s `GROWTH_CONFIG` (or growth never increments).
4. If it animates (tail wag, wing buzz, wiggle-drift): add a rate to `AnimationSystem`'s tables.
5. Add it to `ecs-bridge.js`'s `syncEcsToPond()` — a `forEach([...component names...], ...)`
   block populating a `pond.xxx` render array. **List every component the tooltip/gene-browser
   needs (`Age`, `Genome`) here, not just the ones used for rendering position/size** — a
   missing entry doesn't error, it just silently shows blank data.
6. `pond.js`: push a `this.xxx = []` array in the constructor/reset, and a `check(this.xxx)`
   line in `getEntityAt()`.
7. `ui.js`/`index.html`: slider if spawn-rate controllable, stats display line.
8. Run `node js/ecs/integration.test.js` and the relevant per-system `*.test.js` files.

## Genome Model
**Genotype (regulatory):** POU1F1, THR, MC1R, IGF1, LEP, NR3C1 — crossover + mutation on these only
**Phenotype (expressed):** growthSpeed, bodySize, metabolism, mouthGape, swimSpeed, sightRange, tailRetention, hue, stressResilience — computed from genotype via weighted formulas in `genotypeToPhenotype()`
**Trade-offs:** selecting one gene pulls multiple phenotype traits — e.g. high POU1F1 = fast growth + big body + high metabolism (needs more food)
**NR3C1 (glucocorticoid receptor):** controls stress hormone sensitivity — higher = better resilience against environmental stress events. Trade-off: high NR3C1 competes with other genes in resource allocation.

`expressGenome(genotype)` computes phenotype and **caches it on `genotype._phenotype`** — it is not a separate field you pass around. Components that store genome data use `{ genotype, phenotype: null }`; that `phenotype` field is legacy-shaped and generally unused — call `expressGenome(genome.genotype)` fresh wherever you need trait values.

## Adding a Gene/Trait
- **New regulatory gene:** add to `REGULATORY_GENES[]`, wire into `genotypeToPhenotype()` formulas. breedGenotype already iterates the array.
- **New phenotype trait:** add key to `PHENOTYPE_KEYS[]`, add computation in `genotypeToPhenotype()`. Tooltip and evo stats already iterate the arrays.

## ECS Lifecycle Pattern
```javascript
// Inside a system's update(dt, world):
if (transitionConditionMet) {
  world.markDead(eid);                       // cleaned up by world.reapDead() this same tick
  world.createEntity({ Position: ..., Species: Species('nextStage'), ... });
}
```
`world.reapDead()` runs after every `world.update()` in `main.js`'s game loop.

## Registry Pattern
```javascript
// registry.js
export let pond = null;
export function registerPond(p) { pond = p; }

// pond.js constructor: registerPond(this)
// ui.js: import { pond } from './registry.js' — the only other live consumer
```

## Size Reference
| Entity | Radius | 
|--------|--------|
| Food (algae) | 2–7 |
| Frog spawn egg | 2.5–4 |
| Tadpole | 4→maxSize (6–16) |
| Froglet | 10→maxSize (12–24) |
| Mosquito | 3 |
| Mosquito larva | 2→5 |
| Dragonfly nymph | 9 |
| Dragonfly adult | 12 |

## Verification
```bash
for f in $(find pondemonium/js -name "*.js" -not -name "*.test.js"); do node --check "$f"; done
for f in pondemonium/js/ecs/systems/*.test.js pondemonium/js/ecs/integration.test.js; do node "$f"; done
grep -rn 'randomGenome\|breedGenome\|TRAIT_KEYS' pondemonium/js/*.js  # stale refs = bad
```
