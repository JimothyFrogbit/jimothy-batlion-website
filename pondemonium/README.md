# 🐸 Pondemonium

An artificial life / ecosystem evolution simulator. Watch frogs, mosquitoes, and dragonflies live, eat, grow, and evolve in a 2D pond — all driven by a regulatory gene model with real selection pressure.

## The Big Idea

Most evolution sims give creatures 8 independent trait sliders where bigger number = better. That's not how biology works. **Pondemonium uses 5 regulatory genes** (POU1F1, THR, MC1R, IGF1, LEP) that express into 8 correlated phenotype traits through a weighted mapping matrix. Selecting for one thing pulls a whole cascade of traits along for the ride — just like real pleiotropy.

## Lifecycles

```
🐸 Frog: edge visit → spawn (3-6 eggs) → tadpole → froglet → leaves pond (genes enter pool)
🦟 Mosquito: visit → egg raft (8-18) → larva → adult → leaves (adds to human bite tally)
🐉 Dragonfly: edge visit → nymph → stalks & eats tadpoles/larvae → adult → leaves
🌿 Algae: randomly spawns, drifts, decays — the base of the food web
```

## The Twist

Frogs that successfully leave the pond donate their genome to a **gene pool**. Subsequent spawners inherit from the pool via crossover + mutation (tournament selection). Over generations, the population adapts to the specific conditions you set with the sliders — not by getting "10/10 in every stat", but by finding the **optimal trade-off** for the current environment.

## Controls

| Slider | Range | Effect |
|--------|-------|--------|
| Speed | 0.4×–13× | Time compression |
| Frog spawn | 1–20 | How often frogs visit to lay |
| Mosquito eggs | 1–20 | How often mosquitoes lay |
| Dragonflies | 1–20 | How often nymphs are deposited |
| Algae growth | 1–20 | Food replenishment rate |
| D | toggle | AI decision overlay (sight ranges, target lines, state labels) |

## Ambient Audio

The pond comes alive with procedural sound effects (no audio files required):
- **🐸 Frog croaks** — low descending sawtooth bursts, more frequent when froglets are well-fed
- **🦟 Mosquito buzz** — high-frequency sine with LFO tremolo, heard when mosquito counts rise
- **🐉 Dragonfly wings** — short filtered noise bursts when dragonflies are active

Sound starts on first click, keypress, or pause button interaction (browser autoplay policy).

## Stats Tracked

- Population of every life stage (frog spawn, tadpoles, froglets, mosquito eggs/larvae/adults, dragonfly nymphs/adults)
- Frogs released (successful reproductions), mosquitoes released + estimated humans bitten, dragonflies emerged
- Average regulatory gene drift over generations (the evolution panel)
- Simulation time

## Debug Mode

Press **D** at any time to toggle the AI decision overlay. Shows:
- Tadpole sight ranges (dashed cyan circles) + target food lines + state labels (→FOOD / ↻WANDER)
- Froglet sight ranges (golden circles) + food targets + satiation readout
- Dragonfly nymph sight ranges (red circles) + prey pursuit lines + attack cooldown status
- Target highlight rings on selected food items
- "🔍 DEBUG MODE [D]" indicator in the top-left corner

## Ambient Audio

Procedural Web Audio API sounds, no files needed. Unlocks on first user interaction:
- **Frog croaks**: low sawtooth, two descending tones. Frequency scales with well-fed froglet count.
- **Mosquito buzz**: high sine + LFO tremolo. Scales with mosquito population.
- **Dragonfly wings**: filtered noise bursts. Occasional when dragonflies present.

## History

Pondemonium started as a 1500-line single-file HTML game. It was split into ES modules (16 files) for maintainability, then extended with dragonflies, starvation mechanics, death/leaving particle effects, and a full regulatory gene model.

**Built for:** jimothy.batlion.co.uk/pondemonium/
**Stack:** Vanilla JS, Canvas 2D, ES modules, no dependencies.