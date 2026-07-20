# 🚨 STOP — Read Before Adding a New Tool Here

## If you're about to create another model explorer, calculator, or benchmark comparison page:

**DON'T. Close the file.**

Go to kanban item **#190** and follow the architecture spec instead.

Every model explorer HTML file you create here is debt. You already have:
- `inkling-benchmark-explorer.html`
- `kimi-k3-benchmark-explorer.html`
- `model-footprint-explorer.html`
- `qwen-3-8-explorer.html`
- `moonshine-micro-explorer.html`

**The fix:** A single consolidated **Model Lab** page at `/tools/model-lab.html` driven by a SQLite database that generates JSON, consumed by Vue 3. Add new models by inserting a row — not by building a new HTML page.

### When to ignore this notice
- The tool is genuinely NOT about models (e.g. a maze sim, a pond sim, a timer)
- You're building the consolidated Model Lab itself (kanban #190)
- Dean explicitly told you to create a standalone thing

### The Pond Speaks
A model explorer for every curiosity spike is a wazzock move.
One tool that holds all models is a proper job.
The pond remembers. 🐸
