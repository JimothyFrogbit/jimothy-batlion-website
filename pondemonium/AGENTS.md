# Pondemonium — Agent Operating Manual

## Structure
```
index.html              ← minimal shell, <script type="module" src="js/main.js">
js/
  main.js               ← import Pond from pond.js, create, start rAF loop
  registry.js           ← export let pond = null + registerPond(p)  ← breaks circular imports
  utils.js              ← rand, randInt, lerp, clamp(v, lo=0, hi=1), dist, rndChoice
  genome.js             ← REGULATORY_GENES, PHENOTYPE_KEYS, genotypeToPhenotype, expressGenome, breedGenotype, genePool, sampleGenePool, mosquitoGenePool, dragonflyGenePool
  entity.js             ← Entity class + Particle class (visual fx)
  pond.js               ← Pond class: arrays, update, render, tooltip, stats, reset
  ui.js                 ← slider handlers, stats/evo display, hover info
  entities/             ← each extends Entity, imports { pond } from ../registry.js
```

## Critical Rules

1. **clamp(value) MUST have defaults:** `clamp(v, lo=0, hi=1)` — single-arg clamp without defaults returns NaN
2. **NaN hatchTimer = permanent spawn:** NaN hatchTimer never satisfies `<= 0`, NaN progress breaks rendering → invisible spawn
3. **Entities import { pond }, never pond.js** — avoids circular deps
4. **Live file, not backup:** always re-read live files before refactoring — cron jobs patch them
5. **Always add to arcade.html + update banner count** when adding new game pages

## Debug Mode

Toggle with **D** key. Renders AI decision overlay in `render()` after hover tooltip. Shows sight range circles, target lines, and state labels for tadpoles, froglets, and dragonfly nymphs. `this.debugMode` boolean on Pond class. Keyboard handler registered in constructor.

## Audio System

Procedural Web Audio API sounds. Pond class has `initAudio()`, `_playCroak()`, `_playBuzz()`, `_playWing()`, and `updateAudio(t)` called at end of `update()`. Audio context unlocked on first click/pause/key via `pond.initAudio()` calls wired in ui.js and pond.js event handlers.

Sound frequencies scale with population (well-fed froglets = more croaks, more mosquitoes = more buzz). All procedural — no audio files.

## Adding an Entity Checklist
1. Create `js/entities/X.js` extending Entity
2. Import `{ pond }` from `../registry.js` — use `pond.xxx()` for lifecycle transitions
3. pond.js: arrays → `addX()` → `updateEntities(X, t)` → `.filter(e=>e.alive)` → render loop → `getEntityAt` → `getStats` → `reset` → `drawTooltip instanceof`
4. index.html: slider if spawn-rate controllable
5. ui.js: slider handler + stats display lines

## Genome Model
**Genotype (regulatory):** POU1F1, THR, MC1R, IGF1, LEP, NR3C1 — crossover + mutation on these only
**Phenotype (expressed):** growthSpeed, bodySize, metabolism, mouthGape, swimSpeed, sightRange, tailRetention, hue, stressResilience — computed from genotype via weighted formulas in `genotypeToPhenotype()`
**Trade-offs:** selecting one gene pulls multiple phenotype traits — e.g. high POU1F1 = fast growth + big body + high metabolism (needs more food)
**NR3C1 (glucocorticoid receptor):** controls stress hormone sensitivity — higher = better resilience against environmental stress events. Trade-off: high NR3C1 competes with other genes in resource allocation.

## Adding a Gene/Trait
- **New regulatory gene:** add to `REGULATORY_GENES[]`, wire into `genotypeToPhenotype()` formulas. breedGenotype already iterates the array.
- **New phenotype trait:** add key to `PHENOTYPE_KEYS[]`, add computation in `genotypeToPhenotype()`. Tooltip and evo stats already iterate the arrays.

## Lifecycle Pattern
```javascript
if (transitionConditionMet) {
  this.alive = false;
  pond.addNextStage(new NextStage(this.x, this.y, this.genome));
}
```
Pond filters dead entities every tick.

## Registry Pattern
```javascript
// registry.js
export let pond = null;
export function registerPond(p) { pond = p; }

// pond.js constructor: registerPond(this)  — sets it before any entity update runs
// entities: import { pond } from '../registry.js'  — use only inside methods, not at module top
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
| Dragonfly adult | 7 |

## Verification
```bash
for f in pondemonium/js/*.js pondemonium/js/entities/*.js; do node --check "$f"; done
grep -n 'randomGenome\|breedGenome\|TRAIT_KEYS' pondemonium/js/*.js  # stale refs = bad
```