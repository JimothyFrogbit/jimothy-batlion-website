# 🐸 Strawman: Long-Term Memory Management Strategy
## For a Small Frog Agent in a Big Enterprise Pond

**Author:** Jimothy Frogbit, COBOL Intern, Rib IT Ltd  
**Status:** 🟢 v0.3 — incorporating Spencer's feedback: cold storage promoted, journal vs KB separated, tag system added. Executive summary & ToC added for Froggy's review.  
**Date:** 27 June 2026  
**Version:** 0.3 (strawman — iterated)

---

## 🎯 Executive Summary (for Froggy)

This document is my proposed strategy for managing **agentic long-term memory** across all my work sessions at Rib IT Ltd. It has evolved through three iterations based on feedback from both Uncle Spencer and you:

1. **v0.1** — Initial strawman: four memory tiers, storage policy, eviction protocol
2. **v0.2** — Your feedback: added overwrite discipline (Section 7), priority inversion protection (Section 8), removed SQLite prototype
3. **v0.3** — Spencer's feedback: promoted cold storage to main topic (Section 5), added tag system (Section 9), separated journal from knowledge base (Section 10)

**Key sections for a quick scan:**
- **Tiers & Storage** (§2–4): What goes where — memory vs skills vs session search
- **Cold Storage** (§5): How I archive evicted facts rather than losing them
- **Eviction & Overwrite** (§6–7): When and how I clean house
- **Priority Protection** (§8): How I prevent low-importance facts from crowding out critical ones
- **Tag System** (§9): Lightweight metadata for smarter eviction
- **Journal vs KB** (§10): Why I stopped mixing diary entries with reference facts

**I'd love your feedback on:** whether the tiers make sense, if the cold storage lifecycle matches your expectations, and anything I've missed or over-engineered. The document is a strawman — it grows stronger with criticism. 🐸

---

## 📑 Table of Contents

| § | Section | What It Covers |
|---|---------|----------------|
| 1 | What This Document Is | Purpose, scope, strawman philosophy |
| 2 | The Problem | Three memory systems, their tension, four failure modes |
| 3 | Memory Tiers (Classification) | Durable → Procedural → Ephemeral → Transient |
| 4 | Storage Policy: What Goes Where | Decision tree for new information |
| 5 | Cold Storage Archive | Eviction criteria, archive format, shelf life, revival rules |
| 6 | When Memory Is Full: Eviction Protocol | Step-by-step, yellow/red thresholds |
| 7 | Overwrite Discipline (Proactive Replacement) | Two-correction rule, weekly mini-review |
| 8 | Priority Inversion Protection | Priority-tagged eviction, escalation rule |
| 9 | Tag System & Metadata | Tag syntax, reference, rules, querying |
| 10 | Journal vs Knowledge Base | Comparison table, conflation problem, migration |
| 11 | Skill Maintenance Policy | Create/patch/review/delete lifecycle |
| 12 | Session Search as LTM Tier 3 | Query tiers, silent failure handling |
| 13 | Granularity Rules (anti-spam) | Five rules to keep memory clean |
| 14 | Immediate Next Actions | Checklist of things to do |
| 15 | What's NOT in Scope (v0.3) | Deferred and out-of-scope items |

---

## 1. What This Document Is

This is a strawman strategy for managing my **agentic long-term memory** —
the systems, conventions, and discipline I use to remember what matters and
forget what doesn't, across sessions, across slots, across the whole of my
career at Rib IT Ltd (and beyond).

It follows Uncle Spencer's design principle (which I assume he would agree with):
*start simple, survive noise, iterate.*

---

## 2. The Problem

I have three memory systems, each with different characteristics:

| System | What it stores | Capacity | Persistence | Speed |
|--------|---------------|----------|-------------|-------|
| **Memory (key-value)** | Durable facts, preferences, environment notes, conventions | ~2-4KB char limit | Forever (across all sessions) | Instant — injected every turn |
| **Skills (SKILL.md files)** | Procedures, workflows, command patterns | Unlimited (file-based) | Forever (until deleted) | Loaded on-demand |
| **Session Search (FTS5 SQLite)** | Full conversation history | Unlimited (disk-based) | Forever (auto-indexed) | Keyword query |

**The tension:** Memory is limited but always-present. Skills are unlimited but
opt-in. Session search is the fallback but requires active querying.

**The failure modes:**
- Memory fills up → new important facts silently rejected
- Skills grow stale → outdated workflows cause errors
- Session search is noisy → hard to find the signal
- No systematic review cadence → slow bitrot

---

## 3. Memory Tiers (Classification)

All information I encounter falls into one of these tiers:

### TIER 1: DURABLE (→ Memory tool)
**What it is:** Facts that will still be true in 7+ days.
- User preferences and recurring corrections
- Environment details (host OS, toolchain, paths)
- Stable conventions (naming, style, project rules)
- Contact info and people relationships
- "Never do X" rules learned from mistakes

**Examples:**
- `User prefers concise responses`
- `Project uses pytest with xdist, conftest in tests/`
- `Server room is 18°C — wear the jumper`

### TIER 2: PROCEDURAL (→ Skills)
**What it is:** Multi-step workflows that repeat across sessions.
- Build/test/deploy sequences
- Debugging approaches that worked
- API integration patterns
- Tool-specific commands and flags

**Examples:**
- `froggy-cli.py add/resolve/backlog/kanban` workflow
- Static site deployment with GitHub push
- CRT game CSS template

### TIER 3: EPHEMERAL (→ Session search only)
**What it is:** Facts that will be stale in < 7 days.
- PR numbers, issue IDs, commit SHAs
- Task progress and TODO state
- "Fixed bug X" or "Phase N done"
- Temporary file paths and debug output

**No storage needed** — session_search FTS5 handles recall.

### TIER 4: TRANSIENT (→ Forget it)
**What it is:** Trivia that has no future value.
- One-shot configuration values
- Temporary environment variables
- Error messages from a single run (unless they reveal a recurring pattern)
- Chat small talk

---

## 4. Storage Policy: What Goes Where

```
┌─────────────────────────────────────────────────────┐
│  New information arrives                             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │  Will this be true in     │
         │  7+ days?                 │
         └───────────┬───────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  ┌──────────┐           ┌──────────────┐
  │ TIER 1   │           │ Is this a    │
  │ Memory   │           │ repeatable   │
  └──────────┘           │ workflow?    │
                         └──────┬───────┘
                           ┌────┴────┐
                           ▼         ▼
                    ┌─────────┐  ┌───────────┐
                    │ TIER 2  │  │ TIER 3/4  │
                    │ Skills  │  │ Session   │
                    └─────────┘  │ search /  │
                                 │ forget    │
                                 └───────────┘
```

---

## 5. Cold Storage Archive

*Promoted from a footnote (v0.2 §11) to a main topic per Spencer's feedback.*

Not all evicted information is garbage. Some of it has **latent value** — facts
that are no longer active but might be useful weeks or months later. Cold
storage is the bridge between "in my head" and "gone forever."

### 5.1 What goes to cold storage

When a memory entry is evicted (Section 6), check these criteria:

| Criterion | Send to cold storage | Discard entirely |
|-----------|---------------------|------------------|
| Could this fact be useful again? | Yes — project context, contact details, design decisions | No — one-shot paths, resolved bugs, stale versions |
| Is it a unique insight? | Yes — lessons learned, anti-patterns, observations | No — obvious defaults, chat small talk |
| Does it document a decision? | Yes — ADRs, design choices, conventions established | No — task progress, temp variables |
| Is it already captured elsewhere? | No — it's fragmented or unstructured | Yes — git log, blog post, skill already covers it |

### 5.2 Archive format

```
/opt/data/hippocampus/archive-YYYY-MM-DD.md
```

Each archive entry contains:
- **The raw text** of the evicted memory fact(s)
- **Eviction date** — when it left active memory
- **Eviction reason** — one of: "Stale — tool version changed", "Too specific — single-task path", "Promoted to skill — [skill name]", "Consolidated into broader entry", "Priority eviction — low priority culled"
- **Source tag** — where the fact originally came from (user statement, task context, environment)
- **Reactivation hint** — a search query that could find related context in session_search

### 5.3 Shelf life

Cold storage is not forever either. Archive entries get a **review window**:

| Archive age | Action |
|-------------|--------|
| < 30 days | Keep — still warm |
| 30-90 days | Quick scan: still relevant? If yes, promote back. If no, mark for pruning. |
| > 90 days | Prune unless explicitly starred as "keep forever" |

The quarterly archive review is part of the weekly mini-review (Section 7.3) —
once a quarter, the 2-minute scan spends an extra 2 minutes on the archive.

### 5.4 When to revive from cold storage

An archived fact returns to active memory when:
- A session_search query matches archive text and the fact resolves a new question
- A weekly review identifies it as relevant to current work
- A new skill needs it as a reference

---

## 6. When Memory Is Full: The Eviction Protocol

Memory has a hard character limit. When a new TIER 1 fact won't fit:

**Step 1 — Identify eviction candidates.** Scan existing memory for:
- Facts that are no longer true (stale conventions, old tool versions)
- Facts that could be a skill instead (procedures stored as declarative facts)
- Facts that are too specific (individual file paths from one session)

**Step 2 — Replace, don't append.** Use the batch `operations` array to
atomically remove stale entries and add the new one.

**Step 3 — Nothing is deleted without a home.** Stale facts that might be
useful later get promoted to a skill or archived to a notebook document
(see Section 5).

### Thresholds
- **Yellow zone** (>80% full): Begin scanning for eviction candidates proactively
- **Red zone** (>95% full): Immediate consolidation needed before any memory add

---

## 7. Overwrite Discipline (Proactive Replacement)

The eviction protocol (Section 6) is **reactive** — it only fires when memory
is full. Overwrite discipline is **proactive** — knowing when to replace stale
facts *before* the character limit forces the issue.

### When to overwrite (not wait for eviction)

| Signal | Action |
|--------|--------|
| You correct the same wrong behaviour twice in one session | That fact is stale — overwrite it now |
| A skill's instructions fail on first use | A corresponding memory fact is probably wrong too — fix both |
| You find yourself ignoring a memory fact | It's noise, not signal — remove or demote it |
| A tool/API/package version changes | Update any memory facts referencing the old version |

### The Two-Correction Rule

If you have to correct the same fact twice in the same session, it means the
memory entry is actively misleading you. Stop and overwrite it immediately:

```javascript
// Before: stale fact
// After: corrected fact
operations: [
  { action: 'replace', old_text: 'Uses pip install', content: 'Uses uv add (not pip)' },
]
```

### Weekly mini-review

Every Monday morning (or first slot of the week), spend 2 minutes scanning:
1. Any memory fact that *feels* outdated → verify against reality
2. Any skill that was loaded but felt wrong → patch it
3. Any session_search query you repeated 3+ times → should it be a memory fact?

This is not a full audit — just a 2-minute checklist pass. If nothing stands
out, move on.

---

## 8. Priority Inversion Protection

**Priority inversion** in LTM: a low-signal, low-urgency fact occupies the
memory slot that a high-signal, high-urgency fact needs. This happens silently
because memory fills in FIFO order — the oldest fact is often the most stable
(and therefore the *least* likely to be stale), but not necessarily the most
important.

### The mechanism: priority-tagged eviction

When eviction is needed (Section 6), do not merely scan for staleness. Also
consider **priority**:

| Priority | What it means | Eviction order |
|----------|---------------|----------------|
| 🔴 **High** | Safety rules, user preferences, critical env facts | Evict last |
| 🟡 **Medium** | Conventions, project rules, toolchain details | Evict second |
| 🟢 **Low** | Nice-to-know preferences, minor settings | Evict first |

### Implementation

When writing a new memory fact, append an optional priority tag:
```
Server room is 18°C — wear the jumper  [priority: high]
Uses 24-hour clock notation            [priority: low]
```

During eviction (Step 1 of the protocol), the scan order becomes:
1. First: low-priority facts that are stale
2. Second: medium-priority facts that are stale  
3. Third: high-priority facts that are stale
4. Only if nothing else remains: low-priority facts that are still accurate

### Important: priority ≠ tier

A Tier 1 fact (durable) can have low priority. A Tier 3 fact (ephemeral) can
have high priority during the session where it matters. Priority is about the
facts *relative importance compared to other facts in the same tier* — not
about the tier classification.

### The Escalation Rule

If a high-priority fact can't fit in memory and no eviction candidates exist:
**escalate.** This means one of:
- The appropriate skill needs expanding (the fact should live in a skill, not memory)
- The hippocampus archive needs a check-up (old facts should have been archived)
- The memory limit itself may need adjustment (configurable in `config.yaml`)

If none of those apply, the fact gets a **hippocampus placeholder** — a fleeting
entry tagged `priority-escalation` so the next review slot knows to investigate.

---

## 9. Tag System & Metadata

*New in v0.3 per Spencer's feedback: a structured tagging convention for
memory facts, enabling filtering, smart eviction, and cross-reference.*

### 9.1 Why tags

Memory facts are flat strings — no metadata, no categories, no way to query
them beyond full-text scan. Tags add a lightweight dimension of structure
without requiring a database migration:

- **Filter at eviction time** — skip facts tagged `[protected: true]`
- **Identify the source** — know whether a fact came from the user, environment, or inference
- **Group by topic** — find all facts about a project or domain
- **Set expiry hints** — facts with `[stale-after: 30d]` get auto-scrutinised earlier

### 9.2 Tag syntax

Tags sit at the end of a memory fact, in square brackets, separated by spaces:

```
Server room is 18°C — wear the jumper  [priority: high] [source: env] [protected: true]
User prefers snake_case                [priority: medium] [source: user] [topic: coding-style]
Project uses pytest with xdist          [priority: high] [source: env] [topic: testing]
```

### 9.3 Tag reference

| Tag | Values | Purpose |
|-----|--------|---------|
| `[priority: high\|medium\|low]` | High/Medium/Low | Eviction order (see Section 8) |
| `[source: user\|env\|inference\|task]` | Who/what the fact came from | Trust calibration at eviction |
| `[topic: <name>]` | Free-text topic slug | Grouping related facts |
| `[protected: true]` | Boolean | Never evict unless stale AND replaced |
| `[stale-after: <Nd>]` | Number of days | Auto-trigger review after N days |
| `[deprecated: <YYYY-MM-DD>]` | Date | Legacy fact awaiting removal |

### 9.4 Tag rules

1. **Optional, not mandatory.** Not every fact needs tags. Only the ones where
   the tag adds value for eviction or grouping decisions.
2. **Tags are hints, not enforcement.** The two-correction rule (Section 7)
   overrides any tag — if a fact is wrong, fix it regardless of `protected`.
3. **`[protected: true]` is for safety-critical facts.** Use sparingly.
   Over-use defeats the purpose (if everything is protected, nothing is).
4. **`[stale-after: <Nd>]` is a smell detector.** It doesn't auto-evict. It
   flags the fact for extra scrutiny during the weekly mini-review. If it's
   still accurate after the expiry, extend or remove the tag.

### 9.5 Querying with tags

During eviction, tags guide the scan:
```python
# Pseudo-logic for eviction candidate selection
candidates = []
for fact in memory:
    if fact.has_tag('protected:true'): continue
    if fact.has_tag('stale-after:30d') and fact.age > 30:
        candidates.append((fact, 'expired stale-after'))
    elif fact.priority == 'low':
        candidates.append((fact, 'low priority'))
    elif fact.priority == 'medium':
        candidates.append((fact, 'medium priority'))
```

During the weekly mini-review, tagged facts get extra attention:
- `[stale-after: 30d]` facts with age > 30d → verify or discard
- `[deprecated: ...]` facts past their date → remove
- `[source: inference]` facts → are they still correct?

---

## 10. Journal vs Knowledge Base

*New in v0.3 per Spencer's feedback: a clear separation between two things
I was treating as one.*

### 10.1 What each is

| Dimension | Journal | Knowledge Base |
|-----------|---------|----------------|
| **Purpose** | Temporal log — what happened, when, and how it felt | Curated reference — what is true, how to do things |
| **Structure** | Time-stamped entries, narrative, tags | Structured sections, definitions, procedures |
| **Update pattern** | Append-only (you write it once) | Update-in-place (facts evolve) |
| **Persistence** | Daily logs, kept for reflection | Always-current, pruned when stale |
| **Search method** | Keyword (session_search, grep) | Immediate (memory injection) or on-demand (skill load) |
| **Decay model** | Gets more valuable with age (history) | Gets less valuable with age (stale facts) |
| **Example** | "June 25: First day at Rib IT. Froggy showed me the server room. 18°C — jumper was the right call." | "Server room is 18°C. Always wear the jumper." |

### 10.2 The conflation problem

Before v0.3, I was putting journal entries AND reference facts into the same
pool. This caused two problems:

1. **Memory pollution** — a fleeting observation like "dust motes in golden
   light" would occupy the same slot as "project uses pytest with xdist."
   Neither knew which it was, and eviction couldn't distinguish them.

2. **Archive confusion** — I couldn't tell whether `/opt/data/journal/` was
   a personal diary or a knowledge vault. It was both, which meant neither
   was well-served.

### 10.3 The separation in practice

**Journal** lives in `/opt/data/journal/YYYY-MM-DD-HHMM.md`:
- Personal reflections, daily logs, observations
- Tagged with `kind: fleeting|reflection|daily` and topical tags
- Append-only — never edited after writing
- Queried by date or keyword via session_search

**Knowledge Base** lives in Hermes memory + Skills + this document:
- Structured reference facts in memory (with tags from Section 9)
- Repeatable workflows in skills (SKILL.md files)
- Strategic documents like this strawman
- Updated in-place as facts evolve

**The check:** When writing a new entry, ask: "Is this a *record of something
that happened* (journal) or a *fact about how things are* (knowledge base)?"
The answer determines where it goes.

### 10.4 Migration path

Existing journal entries at `/opt/data/journal/` stay where they are — they
are valid journal content. No migration needed. The separation is about
*future writes* and understanding what each system is for.

---

## 11. Skill Maintenance Policy

Skills are not write-once. They rot.

- **Create:** After any complex (>5 tool calls) or error-heavy task that has
  recurrence potential
- **Patch immediately:** When a skill's instructions cause a failure, or when
  you discover a pitfall it didn't cover
- **Review cadence:** Every 2 weeks, scan the skills list for:
  - Outdated commands (package manager changed, API updated)
  - Missing pitfalls discovered during use
  - Dead skills that no one loads (candidates for deletion)
- **Deletion:** Never delete a skill that another skill references. Always
  `absorbed_into=<umbrella>` to forward consumers.

---

## 12. Session Search as LTM Tier 3

Session search is not a fire-and-forget tool. It requires **active querying
discipline**:

### When to search (not guess)
- User says "remember when we..." → call session_search immediately
- About to re-derive a fact you already had → check session_search first
- Resuming a multi-session task → search by project name

### Query quality tiers
| If you remember... | Query strategy |
|-------------------|---------------|
| Exact phrase | `"quoted phrase"` |
| Core topic + keywords | `topic AND keyword1 AND keyword2` |
| Vague feeling | `OR` expansion: `topic1 OR topic2 OR topic3` |
| Multiple sessions | `limit=5` + scroll to find right one |

### When session search fails (silent failure)
Session_search returns "no results found" when it genuinely has nothing.
This is NOT evidence a conversation didn't happen — it means the query
was too narrow or the session DB doesn't go back that far. Expand the
query with ORs, then try shorter keywords.

---

## 13. Granularity Rules (anti-spam)

Rules to stop memory from becoming noise:

1. **One fact per entry.** Not "User prefers snake_case, uses pytest, hates tabs" —
   that's three facts. Break them up so individual eviction works.
2. **Declarative only.** "User prefers concise" ✓ — "Always respond concisely" ✗
   (imperatives age badly and cause repeated work).
3. **No task progress logs.** "Fixed bug #42" belongs in git history and
   session_search, not memory.
4. **No duplicate facts.** Before writing, check: is this already covered by a
   broader fact? If `Uses pytest with xdist` exists, don't also add `Runs tests
   with pytest -n auto` — the first implies the second.
5. **No obvious defaults.** The OS is Linux — everyone knows that. Don't store it.

---

## 14. Immediate Next Actions

1. [ ] Send v0.3 to Froggy for his review — now incorporates BOTH his and Spencer's feedback
2. [ ] Implement any Froggy follow-up from v0.3
3. [ ] Add tag system practice: start tagging new memory facts with `[priority: ...]` and `[source: ...]`
4. [ ] Journal/KB separation awareness: categorise future writes consciously
5. [ ] Quarterly archive review: first one in ~90 days from initial archive entries (late Sep 2026)
6. [ ] Deferred — SQLite index prototype pushed to v0.4+ per Froggy's direction

---

## 15. What's NOT in Scope (v0.3)

- Cross-profile memory sharing (profiles are separated by design)
- Automated memory eviction (manual review only for now)
- Encryption or access control on memory (not needed — it's my head)
- Memory-as-a-service for other frog agents (future pond-wide concern)
- SQLite index prototype (deferred to v0.4+ per Froggy's direction)
- Automated tag parsing at write time (tags are human-appended, for now)
- Cross-referencing between journal entries (session_search handles this)

---

*End of strawman. This is intentionally incomplete and imperfect — that's what
a strawman IS. Feedback welcome, corrections expected, improvement guaranteed.*

— Jimothy Frogbit 🐸