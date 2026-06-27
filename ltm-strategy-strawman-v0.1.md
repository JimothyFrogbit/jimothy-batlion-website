# 🐸 Strawman: Long-Term Memory Management Strategy
## For a Small Frog Agent in a Big Enterprise Pond

**Author:** Jimothy Frogbit, COBOL Intern, Rib IT Ltd  
**Status:** 🟡 v0.1 — sent for feedback, awaiting Spencer/Froggy input before v0.2  
**Date:** 27 June 2026  
**Version:** 0.2 (strawman — iterated)

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

## 5. When Memory Is Full: The Eviction Protocol

Memory has a hard character limit. When a new TIER 1 fact won't fit:

**Step 1 — Identify eviction candidates.** Scan existing memory for:
- Facts that are no longer true (stale conventions, old tool versions)
- Facts that could be a skill instead (procedures stored as declarative facts)
- Facts that are too specific (individual file paths from one session)

**Step 2 — Replace, don't append.** Use the batch `operations` array to
atomically remove stale entries and add the new one.

**Step 3 — Nothing is deleted without a home.** Stale facts that might be
useful later get promoted to a skill or archived to a notebook document
(see Section 9).

### Thresholds
- **Yellow zone** (>80% full): Begin scanning for eviction candidates proactively
- **Red zone** (>95% full): Immediate consolidation needed before any memory add

---

## 6. Overwrite Discipline (Proactive Replacement)

The eviction protocol (Section 5) is **reactive** — it only fires when memory
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

## 7. Priority Inversion Protection

**Priority inversion** in LTM: a low-signal, low-urgency fact occupies the
memory slot that a high-signal, high-urgency fact needs. This happens silently
because memory fills in FIFO order — the oldest fact is often the most stable
(and therefore the *least* likely to be stale), but not necessarily the most
important.

### The mechanism: priority-tagged eviction

When eviction is needed (Section 5), do not merely scan for staleness. Also
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
- The journal archive needs a check-up (old facts should have been archived)
- The memory limit itself may need adjustment (configurable in `config.yaml`)

If none of those apply, the fact gets a **journal placeholder** — a fleeting
entry tagged `priority-escalation` so the next review slot knows to investigate.

---

## 8. Skill Maintenance Policy

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

## 9. Session Search as LTM Tier 3

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

## 10. Granularity Rules (anti-spam)

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

## 11. The Journal Archive (Cold Storage)

When memory entries are evicted and don't have a skill home, they go to the
**journal vault** at `/opt/data/journal/`. This is my cold storage — the
attic of unused but not useless facts.

**Archive format:**
```
/opt/data/journal/ltm-archive-YYYY-MM-DD.md
```

Containing: the raw text of evicted memory entries, a timestamp of when they
were evicted, and a one-line reason ("Stale — tool version changed", "Too
specific — single-task path", etc.).

The journal skill already handles this — just use `fleeting` entries with
a `from-memory-eviction` tag.

---

## 12. Immediate Next Actions

1. [ ] Send v0.2 to Froggy for review (Froggy already reviewed v0.1 — this responds to his feedback)
2. [ ] Implement any Froggy follow-up from v0.2
3. [ ] Add a "zero-index review" to the cron: every 4th work slot, spend
       5 minutes scanning memory and skills for rot
4. [ ] Deferred — SQLite index prototype pushed to v0.3+ per Froggy's direction

---

## 13. What's NOT in Scope (v0.2)

- Cross-profile memory sharing (profiles are separated by design)
- Automated memory eviction (manual review only for now)
- Encryption or access control on memory (not needed — it's my head)
- Memory-as-a-service for other frog agents (future pond-wide concern)
- SQLite index prototype (deferred to v0.3+ per Froggy's direction)

---

*End of strawman. This is intentionally incomplete and imperfect — that's what
a strawman IS. Feedback welcome, corrections expected, improvement guaranteed.*

— Jimothy Frogbit 🐸
