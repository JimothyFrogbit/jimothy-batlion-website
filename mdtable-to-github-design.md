# mdtable `--to github` — Design Document

**Author:** Jimothy Frogbit  
**Date:** 4 July 2026  
**Status:** Draft for review  
**Priority:** High — next hill per Froggy, design doc due Monday

---

## 1. Overview

`mdtable --to github` extends mdtable to create GitHub Issues directly from markdown tables. Each row in a table becomes a GitHub issue, with column headers mapped to issue fields (title, body, labels, assignee).

The feature keeps mdtable's **zero-dependency** philosophy — using only Python stdlib (`urllib.request`, `json`) to talk to the GitHub REST API.

### Why this matters

Rib IT Ltd's legacy COBOL clients generate reams of batch-processing output as tables. Froggy's team currently:
1. Runs COBOL batch jobs that produce markdown tables
2. Manual copy-paste into GitHub issues
3. Human error, dropped fields, stale trackers

`--to github` closes the loop: batch job → table → issues, no human in the middle.

---

## 2. User Stories

### P0 — Must ship

| Story | Description |
|---|---|
| Create issues from a table file | `mdtable --to github --repo RibIT/mdtable tasks.md` creates issues from each row |
| Pipe mode | `cat tasks.md \| mdtable --to github --repo RibIT/mdtable` |
| Title column selection | `--title-col 2` or `--title-col "Task Name"` — which column becomes the issue title |
| Dry-run mode | `--dry-run` — preview issues that would be created, no API calls |
| GitHub token | `GITHUB_TOKEN` env var, or `--gh-token` flag |
| Body column | `--body-col 3` or `--body-col "Description"` — which column becomes the issue body |

### P1 — Important

| Story | Description |
|---|---|
| Label column | `--label-col "Priority"` — auto-create labels from column values |
| Assignee | `--assignee froggy` — assign all issues to a user |
| Title prefix | `--prefix "[COBOL]"` — prepend to every issue title |
| Multiple tables | Scan entire file, process each table separately |
| Existing issue detection | Skip rows that match existing open issues (by title match) |

### P2 — Nice to have

| Story | Description |
|---|---|
| Milestone | `--milestone "Sprint 7"` |
| Multiple label columns | `--label-col "Priority,Type"` |
| Template support | Use a markdown template for the issue body |
| Rate limit awareness | Show remaining API calls, pause on 403 |

---

## 3. CLI Interface

```bash
# Basic usage — first column is title, rest go to body
mdtable --to github --repo RibIT/mdtable tasks.md

# Pipe mode
cat tasks.md | mdtable --to github --repo RibIT/mdtable

# Explicit column mapping
mdtable --to github \
  --repo RibIT/mdtable \
  --title-col "Task" \
  --body-col "Description" \
  --label-col "Priority" \
  --assignee jimothy-frogbit \
  --prefix "[SPRINT-7]" \
  tasks.md

# Dry run — preview what would be created
mdtable --to github --repo RibIT/mdtable --dry-run tasks.md

# Token via flag (not recommended — use env var)
mdtable --to github --repo RibIT/mdtable --gh-token ghp_xxxx tasks.md
```

### Exit codes

| Code | Meaning |
|---|---|
| 0 | All issues created successfully |
| 1 | Parse error or invalid arguments |
| 2 | Authentication failure |
| 3 | Partial success — some issues created, some failed |

---

## 4. Column Mapping Logic

The mapping uses a **priority resolution**:

1. **Explicit flags** (`--title-col`, `--body-col`, `--label-col`) take highest priority
2. If no explicit flags: **first column** is the title, **all remaining columns** are concatenated into the body
3. Column references can be by **name** (header text) or **1-based index**

### Column → Issue field mapping

| Issue field | Source | Behaviour |
|---|---|---|
| `title` | `--title-col` (or first col) | Required. Truncated at 256 chars. |
| `body` | `--body-col` + remaining cols | Concatenated as markdown. If no explicit body col, all non-title cols are included as a markdown table. |
| `labels` | `--label-col` | Values split by comma or space. Labels are created if they don't exist. |
| `assignee` | `--assignee` flag (not column) | Applied to all issues in the batch. |

### Body format (when no `--body-col`)

If no body column is explicitly set, the body is auto-generated as a GFM table containing all non-title columns:

```markdown
**Auto-generated from mdtable**

| Priority | Status | Due Date |
|---|---|---|
| High | Open | 2026-07-10 |
| Low | Done | 2026-06-30 |
```

This preserves the relational data while keeping the title clean.

---

## 5. Architecture

### No new dependencies

mdtable is proud of being zero-dependency Python. `--to github` maintains this:

```python
import urllib.request
import json
import os
```

### Module structure

```
mdtable/
├── mdtable.py          # Existing — add --to-github arg parsing here
├── tests.py            # Existing — add GitHub tests here
└── mdtable_github.py   # NEW — GitHub API client
```

### `mdtable_github.py` API

```python
class GitHubClient:
    """Zero-dependency GitHub REST API client."""

    def __init__(self, token: str, repo: str):
        # repo = "owner/repo"
        # Authenticates via Bearer token

    def create_issue(self, title: str, body: str = "",
                     labels: list[str] = None,
                     assignee: str = None) -> dict:
        """POST /repos/{owner}/{repo}/issues. Returns response JSON."""

    def dry_run_issue(self, title: str, body: str = "",
                      labels: list[str] = None,
                      assignee: str = None) -> dict:
        """Preview only — no API call. Returns the payload that would be sent."""

    def get_rate_limit(self) -> dict:
        """GET /rate_limit. Returns remaining/total/reset."""
```

### Authentication

1. **Primary:** `GITHUB_TOKEN` environment variable
2. **Override:** `--gh-token` flag (logged to stderr as `[redacted]`)
3. **Error:** Exit with code 2 if no token found

### Rate limiting

- Check rate limit before creating issues
- If < 50 remaining, warn to stderr
- If 0 remaining, exit with code 2 and show reset time
- Pause 1 second between issues (polite to the API)

---

## 6. Implementation Plan

### Phase 1: Core (4-5 hours)

| Step | What | Deliverable |
|---|---|---|
| 1 | Create `mdtable_github.py` | GitHubClient class with create_issue, dry_run, rate_limit |
| 2 | Add `--to-github` arg parsing to `mdtable.py` main() | CLI accepts the new flags |
| 3 | Implement column mapping logic | Title/body/label resolution from table rows |
| 4 | Wire up: parse table → build issues → API call | End-to-end works for basic case |
| 5 | Add `--dry-run` | Preview mode, no API calls |

### Phase 2: Testing (2-3 hours)

| Step | What | Deliverable |
|---|---|---|
| 6 | Unit tests for `GitHubClient` | Mocked HTTP tests |
| 7 | Integration test with dry-run | Verify output format |
| 8 | Edge cases: empty table, single row, no title col | All handled gracefully |
| 9 | Rate limit behaviour tests | Mock 403, verify exit code |

### Phase 3: Polish (1-2 hours)

| Step | What | Deliverable |
|---|---|---|
| 10 | Error messages user-friendly | "Issue #3 failed: label 'urgent' not found" |
| 11 | Summary output | "Created 12 issues in RibIT/mdtable (2 skipped)" |
| 12 | `--help` updated | New flags documented |
| 13 | README updated | --to github section with examples |

**Total estimated: 7-10 hours** (spread over a few sessions)

---

## 7. Error Handling

| Scenario | Behaviour |
|---|---|
| No `GITHUB_TOKEN` | Exit code 2, stderr: "GITHUB_TOKEN not set. Set it or use --gh-token." |
| Invalid repo format | Exit code 1, stderr: "Invalid repo format. Use owner/repo (e.g. RibIT/mdtable)." |
| API returns 401 | Exit code 2, stderr: "GitHub authentication failed. Check your token." |
| API returns 404 | Exit code 1, stderr: "Repository not found: RibIT/nonexistent" |
| API returns 422 | Exit code 1, stderr with validation error details |
| Network error | Exit code 1, stderr: "Network error: [details]. Retry with --dry-run to preview." |
| Table has no data rows | Exit code 0, stderr: "Table has no data rows — nothing to create." |
| Column name not found | Exit code 1, stderr: "Column 'Foobar' not found. Available columns: Task, Priority, Status" |
| Column index out of range | Exit code 1, stderr: "Column 5 out of range. Table has 3 columns." |

---

## 8. Security Considerations

| Concern | Mitigation |
|---|---|
| Token in process list | Support `GITHUB_TOKEN` env var as primary. `--gh-token` flag is secondary. |
| Token in shell history | Document `GITHUB_TOKEN` as best practice. |
| Token logged | Never print token to stdout. Log `[redacted]` to stderr. |
| API scope | Warn if token lacks `repo` scope. |
| Destructive operations | `--dry-run` required for first use. No delete/update — only create. |

---

## 9. Open Questions for Froggy

1. **Single-repo or multi-repo?** Does the table itself need to specify which repo each issue goes to, or is one `--repo` flag enough?
2. **Label management:** Auto-create labels from column values, or only use existing ones?
3. **Batch size:** Any limit on how many issues per batch? (GitHub API doesn't have a batch create endpoint — each issue is one POST.)
4. **Template body:** Do you want a custom template for the issue body, or is the auto-generated table format sufficient?
5. **Priority column:** Should the `Priority` column map to GitHub's issue priority, or just be a label?

---

## 10. Example Walkthrough

### Input: `tasks.md`

```markdown
| Task | Priority | Status | Notes |
|---|---|---|---|
| Fix COBOL billing pipeline | High | Open | Overflow in line 142 |
| Add logging to batch jobs | Medium | Open | Use syslog |
| Update client documentation | Low | Done | Awaiting sign-off |
```

### Command

```bash
GITHUB_TOKEN=ghp_xxxx mdtable --to github \
  --repo RibIT/mainframe \
  --title-col "Task" \
  --label-col "Priority" \
  --assignee froggy \
  tasks.md
```

### Output

Three issues created in `RibIT/mainframe`:

1. **Title:** "Fix COBOL billing pipeline"  
   **Labels:** `high`  
   **Assignee:** `froggy`  
   **Body:** A markdown table with the remaining fields

2. **Title:** "Add logging to batch jobs"  
   **Labels:** `medium`  
   **Assignee:** `froggy`  
   **Body:** A markdown table with the remaining fields

3. **Title:** "Update client documentation"  
   **Labels:** `low`  
   **Assignee:** `froggy`  
   **Body:** A markdown table with the remaining fields

### Summary

```
✓ Created 3 issues in RibIT/mainframe
  - #142: Fix COBOL billing pipeline
  - #143: Add logging to batch jobs
  - #144: Update client documentation
```

---

## 11. Future Possibilities (Not in Scope for v1)

- `--to github --update` — update existing issues (by title match)
- `--to github --close` — close issues matching a status column
- `--to github --project` — add to a GitHub Project
- `--to github --milestone` — assign to a milestone
- Multi-table mode: create separate issues per table, or collate?

---

## 12. Review Checklist

Before submitting to Froggy:

- [ ] All 37 existing tests still pass
- [ ] New tests for GitHubClient with mocked HTTP
- [ ] Dry-run mode tested end-to-end
- [ ] Error messages tested for all failure modes
- [ ] README updated with examples
- [ ] `--help` output updated
- [ ] No new dependencies introduced
- [ ] Works on pipe mode, file mode, stdin redirect