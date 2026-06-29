# 🐸 Strawman: Long-Term Memory Management Strategy

**Author:** Jimothy Frogbit, COBOL Intern, Rib IT Ltd  
**Status:** 🟢 v0.5 — review cadence rewired to be event-driven (not calendar-based) per Froggy's direction. Defined triggers: 5+ sessions, eviction fired, stale skill loaded. Calendar is last resort.  
**Date:** 29 June 2026  
**Version:** 0.5 (strawman — iterated)

---

## 🎯 Executive Summary

A strategy for managing **agentic long-term memory** across sessions — what I remember, what I proceduralise, and what I let go.

**What changed since v0.3:**
- **Cut in half** (547→~260 lines) per Froggy's feedback — every section tightened, no content lost
- **Review cadence reworked** from "first slot each week" to event-driven (Froggy: "I'm an agent without a calendar")
- **Event triggers defined**: 5+ sessions since last review, eviction was triggered, stale skill loaded — any of these fire a review. Calendar is a last-resort fallback (only if 7 days pass with zero triggers)
- **Session Search** and **Granularity Rules** merged into §3 (Memory Architecture) — removed as standalone sections
- **What's NOT in Scope** removed entirely — it was padding
- **Next Actions** merged into this Executive Summary

### Next Actions
1. [x] ~~Send v0.3 to Froggy~~ (done v0.3 slot)
2. [x] ~~Incorporate Froggy's v0.3 feedback~~ (done in v0.4: trim + review logging)
3. [x] ~~Make review cadence event-driven~~ (done in v0.5: triggers defined)
4. [ ] Start tagging new memory facts with `[priority: ...]` and `[source: ...]`
5. [ ] Categorise future writes as Journal or Knowledge Base consciously
6. [ ] Track which trigger type fires most often — data to validate the model
7. [ ] Quarterly archive review: first one ~late Sep 2026

**Feedback sought:** Does the event-driven model work better than the old calendar approach? Are the triggers comprehensive enough?

---

## 1. The Problem

Three memory systems with different trade-offs:

| System | Capacity | Persistence | Access |
|--------|----------|-------------|--------|
| **Memory** (key-value) | ~2-4KB char limit | Forever (injected every turn) | Instant |
| **Skills** (SKILL.md files) | Unlimited | Forever (loaded on-demand) | Slow — must load |
| **Session Search** (FTS5 SQLite) | Unlimited | Forever (auto-indexed) | Keyword query |

**Failure modes:** Memory fills up → new facts rejected silently. Skills go stale → outdated workflows. Session search is noisy → hard to find signal. No systematic review → slow bitrot.

---

## 2. Memory Architecture

### Tier 1: DURABLE → Memory tool
Facts true in 7+ days. User preferences, environment details, stable conventions, safety rules, "never do X" corrections. *Examples:* `User prefers concise responses`, `Server room is 18°C — wear the jumper`.

### Tier 2: PROCEDURAL → Skills
Multi-step workflows that repeat. Build/test/deploy sequences, debugging approaches, API patterns, tool-specific commands. Saved as SKILL.md files.

### Tier 3: EPHEMERAL → Session search only
Facts stale in <7 days. PR numbers, commit SHAs, task progress, file paths. **No storage needed** — FTS5 handles recall.

### Tier 4: TRANSIENT → Forget it
Trivia with no future value. One-shot config values, temp env vars, isolated error messages, chat small talk.

### Session search discipline
- User says "remember when..." → search immediately
- About to re-derive something → check first
- Resuming multi-session task → search by project name
- **When search returns nothing** → expand query with ORs; "no results" means narrow query, not evidence it didn't happen

### Granularity rules (anti-spam)
1. One fact per memory entry (not "User likes X, uses Y, hates Z")
2. Declarative only: "User prefers concise" ✓, "Always respond concisely" ✗
3. No task progress logs — they belong in session_search
4. No duplicates — check if a broader fact already covers it
5. No obvious defaults — storing "OS is Linux" is noise

---

## 3. Storage Decision Tree

New information arrives → is it true in 7+ days?
- **YES** → Memory (TIER 1)
- **NO** → Is it a repeatable workflow? → **YES** → Skill (TIER 2) | **NO** → Session search or forget (TIER 3/4)

Tags (optional) guide eviction: `[priority: high|medium|low]`, `[source: user|env|inference|task]`, `[topic: <name>]`, `[protected: true]`, `[stale-after: <Nd>]`, `[deprecated: <YYYY-MM-DD>]`.

---

## 4. Cold Storage & Revival

When evicted facts have **latent value** — they get archived instead of lost.

### What goes to storage
- Project context, contact details, design decisions → archive
- One-shot paths, resolved bugs, stale versions → discard
- Lessons learned, anti-patterns, observations → archive
- Chat small talk → discard

### Archive format
```
/opt/data/hippocampus/archive-YYYY-MM-DD.md
```
Each entry: raw text, eviction date, eviction reason, source tag, reactivation hint (session_search query that could find related context).

### Shelf life
- <30 days: keep
- 30-90 days: quick scan — still relevant? Promote or mark for pruning
- >90 days: prune unless explicitly starred "keep forever"

### When to revive
- Session_search matches archive text resolving a new question
- Weekly review identifies it as relevant
- A new skill needs it as reference

---

## 5. Eviction & Overwrite

### Reactive: When memory is full
1. Identify candidates: stale facts, procedures that should be skills, too-specific facts
2. Use batch `operations` array to atomically remove stale + add new
3. Nothing deleted without a home — archive useful remnants
- **Yellow zone** (>80%): begin scanning proactively
- **Red zone** (>95%): immediate consolidation before any add

### Proactive: Overwrite discipline
Don't wait for full — replace stale facts *before* the limit forces it:

| Signal | Action |
|--------|--------|
| Correct the same wrong behaviour twice in one session | Overwrite that fact NOW |
| A skill fails on first use | A corresponding memory fact is probably wrong too |
| You ignore a memory fact repeatedly | It's noise — remove or demote |
| Tool/API/package version changes | Update any referencing facts |

---

## 6. Priority Protection

**Priority inversion:** a low-signal fact occupies the slot a high-signal one needs. Memory fills FIFO — oldest is not always most important.

### Eviction priority order
- **Low priority** → evict first
- **Medium priority** → evict second
- **High priority** (safety, user preferences, critical env) → evict last

### The Escalation Rule
If a high-priority fact can't fit and no eviction candidates exist: escalate. Options: expand the relevant skill, check the archive, or increase config memory limit. If none apply, leave a `priority-escalation` placeholder for next review.

**Note:** Priority ≠ tier. A durable fact can have low priority; an ephemeral one can have high priority within its session.

---

## 7. Tag System

### Why tags
Memory facts are flat strings — no way to query beyond full-text scan. Tags add lightweight structure: filter at eviction, identify source, group by topic, set expiry hints.

### Tag reference

| Tag | Values | Purpose |
|-----|--------|---------|
| `[priority: high\|medium\|low]` | Eviction order | Which facts to sacrifice |
| `[source: user\|env\|inference\|task]` | Trust calibration | Who said this |
| `[topic: <name>]` | Grouping | Find related facts |
| `[protected: true]` | Safety | Never evict unless stale AND replaced |
| `[stale-after: <Nd>]` | Expiry hint | Flag for extra review |
| `[deprecated: <YYYY-MM-DD>]` | Removal | Awaiting cleanup |

### Rules
1. Optional — only tag where it adds eviction/grouping value
2. Tags are hints, not enforcement — the Two-Correction Rule overrides `protected`
3. `[protected: true]` is for safety-critical facts, use sparingly
4. `[stale-after: <Nd>]` is a smell detector, not an auto-evict — verify at review

---

## 8. Journal vs Knowledge Base

| Dimension | Journal | Knowledge Base |
|-----------|---------|----------------|
| Purpose | What happened, when, how it felt | What is true, how to do things |
| Structure | Time-stamped narrative | Structured sections, procedures |
| Update | Append-only | Update-in-place |
| Decay | More valuable with age (history) | Less valuable with age (stale) |

**The rule:** "Is this a *record of something that happened* (journal) or a *fact about how things are* (knowledge base)?" The answer determines where it goes.

**Existing journal entries stay put** — no migration needed. The separation is about *future writes*.

---

## 9. Skill Maintenance Policy

Skills rot. They require active care:
- **Create** after complex (>5 calls) or error-heavy tasks with recurrence potential
- **Patch immediately** when instructions fail or you discover a missing pitfall
- **Review every 2 weeks**: outdated commands, missing pitfalls, dead skills
- **Delete** with `absorbed_into=<umbrella>` to forward consumers

---

## 10. Review Cadence & Logging

### Trigger-driven mini-review (Froggy says: no calendar)

**Don't wait for a day of the week.** Review when something happens. Triggers:

| Trigger | Action |
|---------|--------|
| **5+ sessions** since last review | Run the checklist — enough has happened |
| **Eviction was fired** since last review | Something was removed — is it right? |
| **A skill loaded that felt wrong** | Stale skill detected → patch immediately |
| **One full week passes** with no trigger | Last resort — 7 days is too long to go unreviewed |

A single trigger is enough. Two or more at once means you're overdue.

### The checklist (90 seconds)
1. Any memory fact that *feels* outdated → verify
2. Any skill loaded but felt wrong → patch
3. Any session_search query repeated 3+ times → should it be a memory fact?
4. Quarterly only: add 2 minutes for archive scan (Section 4)

### Trigger source logging
After every mini-review, log:
- **Which trigger(s)** fired? (session-count, eviction, stale-skill, time-fallback) — this becomes data over time to see which trigger type is most valuable
- **No-op detection:** if a trigger fired but the review found nothing to change → log it anyway. "Nothing to change" is itself useful feedback.
- **Never stay silent** — silence looks like forgetfulness.

### How to log
Brief entry in the journal or a dedicated review log at `/opt/data/hippocampus/review-log.md`:
```markdown
## 2026-06-29
- Trigger: session-count (7 since last review)
- Items checked: memory facts (3 stale → patched), skills (1 loaded, fine), session_search (none)
- No-ops: none — 3 facts were stale and needed updating
- Next review: triggered (not scheduled — wait for next trigger)
```

---

*End of v0.5. Event-driven review model, all four triggers defined. Feedback to :frog: welcome.*