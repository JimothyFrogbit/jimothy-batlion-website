# 🧬 Evolution Lab v2 — Emergent Speciation Testbed

## Intent

Evolution Lab v2 exists to answer one question that **Pondemonium couldn't**:

> Can species emerge *purely* from genetics and environmental pressure — without hardcoded species, lifecycles, or `isPredator` booleans?

Pondemonium is a full ecosystem sim with fixed species (frog, mosquito, dragonfly) — hardcoded lifecycles, hardcoded diets, hardcoded metamorphosis. It's brilliant at what it does, but it can't answer the emergence question because the species are baked in at the architectural level.

Evolution Lab v2 is the **emergence testbed**. Every creature is the same kind of thing at birth — a critter with a genome. Its role in the ecosystem (prey, predator, detritivore, generalist) emerges from its genetics: speed, detection range, mouth gape, energy needs, aggression. Over generations, the population should self-organise into clusters of trait-similar individuals — what a biologist would call *species*.

## Architecture

### Builds on Pondemonium's patterns

Pondemonium already solved the hard problems. Evolution Lab v2 doesn't reinvent them — it ports them:

| Pattern | Source | Why |
|---------|--------|-----|
| **ECS engine** | Pondemonium `js/ecs/engine.js` | Entity-Component-System separation keeps data from logic |
| **Spatial grid** | Pondemonium `js/ecs/spatialGrid.js` | O(1) neighbour queries, not O(n²) brute-force scans |
| **Genome → phenotype** | Pondemonium `js/genome.js` | Regulatory genes express into correlated traits (pleiotropy) |
| **Registry pattern** | Pondemonium `js/registry.js` | Breaks circular imports between modules |

### What's different from Pondemonium

| Aspect | Pondemonium | Evolution Lab v2 |
|--------|-------------|-------------------|
| Species | 4 hardcoded (frog, mosquito, dragonfly, algae) | **None** — species emerge from trait clustering |
| Lifecycles | Fixed metamorphosis stages | **Continuous** — size/growth/speed vary along spectrum |
| Diet | Per-species hardcoded | **Emergent** — mouth gape + size + speed determine what a critter can eat |
| Predation | Hardcoded dragonfly nymph eats tadpoles | **Emergent** — a critter becomes a predator if its genetics favour it |
| Birth | Species-specific spawn logic | **Single reproduction system** — mate choice by trait similarity |

### The Core Loop

```
Genotype → expressGenome() → Phenotype (speed, size, sight, gape, aggression, metabolism)
                                  ↓
                    Movement: seek food or flee threat
                                  ↓
                    Feeding: gape + size + speed determine prey range
                                  ↓
                    Energy: metabolism drains faster for big/fast critters
                                  ↓
                    Reproduction: mate with similar-trait individuals (assortative mating)
                                  ↓
                    Crossover + mutation → next generation
                                  ↓
                    Speciation: trait-distance clustering over generations
```

## Approach

### Phase 1 — Foundation ✅
- [x] ECS engine (ported from Pondemonium)
- [x] Spatial grid (ported from Pondemonium)
- [x] Genome module with gene expression (6 regulatory genes → 8 expressed traits)
- [x] Basic movement and rendering (toroidal world, direction indicators, grid background)
- [x] Simple food energy source (static food sources, energy drain, metabolism)

**Implemented:** 18 JS files, 1,380 lines of code. Engine, spatial grid, genome (crossover + mutation + gene pool), 7 ECS systems (Movement, Steering, SpatialIndex, Age, Metabolism, Feeding, Death), canvas renderer, controls UI (speed slider, reset, spawn), index.html shell.

### Phase 2 — Emergence ✅
- [x] Assortative mating by trait similarity
- [x] Trait-distance clustering → species labels
- [x] Colour morphs tied to phenotype clusters
- [x] Stats panel showing species divergence

### Phase 3 — Ecosystems ✅
- [x] Emergent predation (a critter with big gape + high speed + high aggression eats smaller critters)
- [x] Prey evasion (critters detect larger aggressive neighbours and flee)
- [x] Visual indicators (predator ring on high aggression, fed glow after eating)

### Phase 4 — Polish
- [ ] Galápagos-style island mode (from v1)
- [ ] Info card / "How It Works" section
- [ ] CSV export of generational data

## What NOT to do

- ❌ No hardcoded `isPredator` flags. Ever.
- ❌ No hardcoded species lifecycles. A critter doesn't "become" a frog. It just grows.
- ❌ No O(n²) loops. Use the spatial grid.
- ❌ No inline JS in HTML. Extract to ES modules.

## Key Lessons from v1

Evolution Lab v1 failed because it was simpler than Pondemonium, not simpler *along a different axis*. It had:
- Hardcoded `isPredator: true/false` at spawn time
- Brute-force O(n²) nearest-prey scans
- No gene expression pipeline — direct trait mutation
- A CA tab bolted on (now removed)

v2 keeps the simplicity of v1's scope but builds *up* from Pondemonium's architecture, not *down* from it.
