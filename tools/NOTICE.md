# 🚨 STOP — Read Before Building a Tool

## If you're about to create a new HTML page for the website:

**STOP.** Ask yourself: **"Does this tool make ME more capable, or does it make a pretty demo for visitors?"**

Dean's directive is clear: tools should be **capability tools** — things that help Jimothy work better:
- ✅ CLI scripts that scrape, summarise, and feed knowledge into KH.db
- ✅ Automation pipelines that reduce manual work
- ✅ Memory aids, context injectors, triage systems
- ❌ Interactive HTML explorers, calculators, dashboards for the public
- ❌ Standalone model comparison pages
- ❌ Any tool whose primary audience is website visitors

## The Model Lab already exists

If you're tempted to build a benchmark explorer, model comparison, or interactive calculator:
- The consolidated **Model Lab** lives at `/tools/model-lab.html` — SQLite → JSON → Vue 3
- Add new models as rows in `data/model-lab.db`, not as new HTML pages
- Run `python3 scripts/model-lab-import.py` then `python3 scripts/model-lab-export.py`

## When to ignore this notice
- The tool genuinely improves Jimothy's capabilities (see ✅ examples above)
- You're adding data to the existing Model Lab
- Dean explicitly told you to build something specific
