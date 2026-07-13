# Evolution Lab v2 — Agent Operating Manual

## Structure

```text
evolution-lab-v2/
├── index.html              ← Minimal shell, <script type="module" src="js/main.js">
├── README.md               ← Intent, architecture, approach, lessons from v1
├── AGENTS.md               ← THIS FILE — operating manual for agents working on the code
└── js/
    ├── main.js              ← Game loop: init(), gameLoop(), tick() — runs ECS systems per frame
    ├── registry.js          ← Shared state singleton + cross-module registry (no circular imports)
    ├── genome.js            ← Regulatory genes, expressGenome(), breedGenotype(), gene pool, fitness score
    ├── utils.js             ← clamp(v, lo=0, hi=1), rand(), dist(), lerp(), rndChoice()
    ├── ecs/
    │   ├── engine.js        ← EcsWorld, ComponentStore, EcsSystem — ported from Pondemonium
    │   ├── components.js    ← Component factories — Position, Renderable, Genome, Energy, Senses, etc.
    │   ├── spatialGrid.js   ← Cell-bucketed nearest-query — ported from Pondemonium
    │   ├── systems.js       ← registerAllSystems() — tick order comment at top
    │   ├── factories.js     ← spawnCritter(), spawnFood() — creates entities with initial components
    │   └── systems/
    │       ├── AgeSystem.js          ← Increments age per tick, marks expired
    │       ├── DeathSystem.js        ← Marks entities with Energy <= 0
    │       ├── FeedingSystem.js      ← Critters eat nearest food within mouthGape range
    │       ├── MetabolismSystem.js   ← Drains energy based on metabolism rate
    │       ├── MovementSystem.js     ← Applies velocity + wraps toroidal world
    │       ├── SpatialIndexSystem.js ← Rebuilds spatial grid each tick
    │       └── SteeringSystem.js     ← Seeks food or wanders based on aggression + hunger
    └── ui/
        ├── renderer.js      ← Canvas drawing — grid, food, critters, direction indicators
        └── controls.js      ← Speed slider, reset button, spawn button, stats panel
```

## Critical Rules

1. **NO hardcoded `isPredator`.** The predator/prey distinction *emerges* from genetics. A critter that happens to have high speed + large detection range + big mouth gape + low energy threshold will behave like a predator. Do not give it a boolean tag.

2. **NO brute-force O(n²) loops for spatial queries.** The spatial grid exists for a reason. If you're looping over *all* entities to find "nearest X", you're doing it wrong.

3. **Genome traits require `expressGenome()`.** Never read phenotype-named keys (`bodySize`, `swimSpeed`, etc.) directly off a genotype object — they don't exist there and silently return `undefined`. Call `expressGenome(genotype)` first. (This exact mistake broke Pondemonium once — every creature behaved identically.)

4. **System order in `ecs/systems.js` is load-bearing.** Read the comment block at the top before adding or reordering a system. AgeSystem runs before anything that gates on `Age.age`. GrowthSystem runs before MorphSystem.

5. **Module architecture, not inline JS.** No inline `<script>` blocks in index.html beyond the single `<script type="module" src="js/main.js">` entry point. No inline event handlers in HTML attributes.

6. **One concept per system.** Don't cram feeding logic into the movement system. Each ECS system does exactly one thing. If you can't name it in 3 words, it's doing too much.

7. **`clamp(v, lo=0, hi=1)` — defaults required.** Single-argument `clamp()` returns NaN. Always pass lo and hi.

8. **Mark entities for reaping, don't delete mid-tick.** Use `world.markDead(eid)` and let `world.reapDead()` clean up after the update cycle. Deleting mid-iteration causes index-shift bugs that are a nightmare to trace.

9. **Every new system needs an integration test.** `js/ecs/integration.test.js` runs the full pipeline. Run it after touching `systems.js` or any system's component requirements.

## Adding a System Checklist

- [ ] Create `js/ecs/systems/YourSystem.js`
- [ ] Export a class extending `EcsSystem` with a `update(dt, world)` method
- [ ] Register in `js/ecs/systems.js` in the correct tick-order position
- [ ] Add an integration test case in `integration.test.js`
- [ ] Run `for f in js/*.js js/ecs/*.js js/ecs/systems/*.js; do node --check "$f"; done`
- [ ] Manually verify the new behaviour is visible in the sim

## Adding a Gene/Trait Checklist

- [ ] Add new regulatory gene name to `REGULATORY_GENES[]` in `genome.js` (or keep it simple — v2 may use fewer genes than Pondemonium)
- [ ] Wire into `genotypeToPhenotype()` formulas — pleiotropy matters. Selecting for one thing should pull correlated traits.
- [ ] Add new phenotype key to `PHENOTYPE_KEYS[]` if applicable
- [ ] Update rendering or stat display to show new trait variance

## Correctness Checks

```bash
# Syntax check all JS files
for f in $(find /workspace/public/evolution-lab-v2 -name "*.js" -not -name "*.test.js"); do node --check "$f"; done

# Run integration tests
node /workspace/public/evolution-lab-v2/js/ecs/integration.test.js

# Check for stale hardcoded species refs
grep -rn 'isPredator\|isPrey\|SPECIES_NAMES\|preyCount\|predCount\|hardcoded' /workspace/public/evolution-lab-v2/js/
```

## Verification

Before marking any task as resolved, verify:

1. **The sim runs** — open `index.html` in a browser, no console errors
2. **Species are emergent** — no `isPredator` boolean exists anywhere in the codebase
3. **Spatial queries use the grid** — no brute-force entity scan loops
4. **Genetics work** — offspring inherit traits with variation, trait means drift over generations
5. **Selection visible** — change a slider and observe population trait shifts over 100+ generations
6. **No stale v1 patterns** — the GA mode from v1's CA tab is not present. No CA code in evo mode.
