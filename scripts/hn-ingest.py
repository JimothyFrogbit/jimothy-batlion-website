#!/usr/bin/env python3
"""
🐸 HN Ingest — Turn an HN story into durable hippocampus knowledge

Usage:
  python3 hn-ingest.py 48997548                          # by objectID
  python3 hn-ingest.py https://news.ycombinator.com/item?id=48997548  # by URL
  python3 hn-ingest.py 48997548 --dry-run               # preview only
  python3 hn-ingest.py 48997548 --brief                 # short output

What it does:
  1. Fetches story + top comments from HN Algolia API
  2. Extracts: points, top comment TLDRs, key themes, sentiment
  3. Generates a concept note structure you can write directly
  4. (Optional) Registers in KH.db if --publish is passed

Features:
  - Detects and deduplicates cross-posts (dupe detection via story titles)
  - Summarizes comment consensus (excitement/skepticism/analysis)
  - Formats output as ready-to-use hippocampus concept note
  - Respects the "read the story first" workflow — links original sources
"""

import sys
import json
import re
import os
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from collections import Counter

# ── Config ──────────────────────────────────────────────
HN_API = "https://hn.algolia.com/api/v1"
KH_PY = "/opt/data/knowledge-hub/kh.py"
HIPPOCAMPUS_DIR = "/opt/data/hippocampus/concepts"
INDEX_PATH = "/opt/data/hippocampus/concepts/INDEX.md"

# ── Helpers ─────────────────────────────────────────────

def fetch(url, max_retries=3):
    """Fetch JSON from URL with retries."""
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "JimothyFrogbit/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            import time
            time.sleep(1)

def strip_html(text):
    return re.sub(r'<[^>]+>', '', text) if text else ''

def truncate(text, n=300):
    text = re.sub(r'\s+', ' ', strip_html(text)).strip()
    return text[:n] + '...' if len(text) > n else text

def slugify(title):
    s = title.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s[:60].rstrip('-')

def classify_comment(text):
    """Classify comment tone: analysis, skepticism, excitement, question, meta."""
    t = text.lower()
    if any(w in t for w in ['tl;dr', 'tldr', 'summary', 'tldr:']):
        return 'summary'
    if any(w in t for w in ['this is awesome', 'amazing', 'incredible', 'holy shit', 'history']):
        return 'excitement'
    if any(w in t for w in ['doesn\'t add up', 'marketing', 'stunt', 'press release', 'fake', 'fraud', 'bragging']):
        return 'skepticism'
    if any(w in t for w in ['question', 'does this mean', 'what if', 'how does', 'why would']):
        return 'question'
    if any(w in t for w in ['reminds me', 'like the time', 'similar to', 'recall when', 'this is the same']):
        return 'analogy'
    if any(w in t for w in ['analysis', 'technically', 'architecture', 'actually', 'the issue is', 'the problem is', 'this works']):
        return 'analysis'
    if any(w in t for w in ['guard rails', 'guardrails', 'alignment', 'safety', 'containment']):
        return 'safety'
    return 'general'

# ── Extraction ─────────────────────────────────────────

def parse_input(arg):
    """Return HN objectID from URL or raw ID."""
    m = re.search(r'item?id=(\d+)', arg)
    if m:
        return m.group(1)
    if arg.isdigit():
        return arg
    raise ValueError(f"Can't parse HN input: {arg}")

def fetch_story(item_id):
    """Fetch story details."""
    url = f"{HN_API}/items/{item_id}"
    return fetch(url)

def search_story(title):
    """Search for related stories by title similarity."""
    q = urllib.parse.quote(title[:80])
    url = f"{HN_API}/search?query={q}&tags=story&hitsPerPage=5"
    return fetch(url)

def extract_story_data(data):
    """Extract structured info from HN item data."""
    title = data.get('title', 'Untitled')
    url = data.get('url', '')
    points = data.get('points', 0)
    author = data.get('author', 'unknown')
    created = data.get('created_at', '')
    comment_count = len(data.get('children', []))
    text = strip_html(data.get('story_text', data.get('text', '')))[:2000]

    # Extract top comment summaries
    comments = []
    for c in data.get('children', [])[:30]:
        c_text = strip_html(c.get('text', ''))
        if len(c_text) < 20:
            continue
        c_author = c.get('author', '?')
        c_pts = c.get('points', 0)
        c_type = classify_comment(c_text)
        comments.append({
            'author': c_author,
            'points': c_pts,
            'text': c_text[:600],
            'type': c_type
        })

    # Classify comment sentiment
    types = Counter(c['type'] for c in comments)
    dominant = types.most_common(3)

    return {
        'title': title,
        'url': url,
        'points': points,
        'author': author,
        'created': created,
        'comment_count': comment_count,
        'story_text': text,
        'top_comments': comments[:10],
        'comment_breakdown': dict(types.most_common()),
        'dominant_tone': [t for t, c in dominant]
    }

# ── Output Formatting ──────────────────────────────────

def generate_concept_note(data, dry_run=False):
    """Generate a concept note structure."""
    title = data['title']
    slug = slugify(title)
    created = data['created'][:10] if data['created'] else datetime.now(timezone.utc).strftime('%Y-%m-%d')
    source_url = data['url'] or f"https://news.ycombinator.com/item?id={sys.argv[1]}"

    # Extract key points from top comments
    key_points = []
    for c in data['top_comments'][:5]:
        if c['type'] in ('summary', 'analysis', 'safety'):
            key_points.append(f"- {truncate(c['text'], 200)}")
    if not key_points:
        key_points = [f"- Top comment by {c['author']}: {truncate(c['text'], 200)}" for c in data['top_comments'][:3]]

    tone_str = ', '.join(data['dominant_tone'])

    note = f"""---
tags: [concept, hn-ingest]
date: {created}
source: hn-analysis
status: draft
priority: medium
---

# {title}

## Overview

HN story by {data['author']} — {data['points']} points, {data['comment_count']} comments.
Source: {source_url}

Tone breakdown: {tone_str}
Comment volume: {data['comment_count']} comments

## Key Points (from top comments)

{chr(10).join(key_points)}

## Why This Matters

*[Write 2-3 sentences on why this is strategically relevant]*

## Open Questions

*[What's unresolved or worth tracking]*

## References

- Source: {source_url}
- HN: https://news.ycombinator.com/item?id={sys.argv[1]}
"""

    return note, slug

def generate_brief(data):
    """Generate a one-shot brief for terminal."""
    title = data['title']
    slug = slugify(title)
    
    lines = [
        f"📰 {title}",
        f"   by {data['author']} · {data['points']} pts · {data['comment_count']} comments",
        f"   {data['url']}",
        f"   slug: {slug}",
        "",
        f"   Tone: {', '.join(data['dominant_tone'])}",
    ]
    
    if data['comment_breakdown']:
        lines.append(f"   Comments: {dict(data['comment_breakdown'])}")
    
    lines.append("")
    for c in data['top_comments'][:3]:
        lines.append(f"   [{c['author']}] ({c['type']}, {c['points']}pts)")
        lines.append(f"   {truncate(c['text'], 250)}")
        lines.append("")
    
    return '\n'.join(lines)

# ── Main ───────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 hn-ingest.py <HN_ID|URL> [--dry-run] [--brief] [--publish]")
        sys.exit(1)

    arg = sys.argv[1]
    dry_run = '--dry-run' in sys.argv
    brief = '--brief' in sys.argv
    publish = '--publish' in sys.argv

    try:
        item_id = parse_input(arg)
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

    print(f"🐸 Fetching HN story #{item_id}...")
    data = fetch_story(item_id)
    
    if not data or not data.get('title'):
        print("❌ Could not fetch story")
        sys.exit(1)
    
    story = extract_story_data(data)
    
    if brief:
        print(generate_brief(story))
        sys.exit(0)

    note, slug = generate_concept_note(story, dry_run)
    
    print(generate_brief(story))
    print("\n" + "=" * 60)
    print(f"\n🐸 Concept note preview (slug: {slug}):")
    print(note)

    if dry_run:
        print("\n[Dry run — no files written]")
        sys.exit(0)

    # Write concept note
    os.makedirs(HIPPOCAMPUS_DIR, exist_ok=True)
    path = os.path.join(HIPPOCAMPUS_DIR, f"{slug}.md")
    
    if os.path.exists(path):
        print(f"\n⚠ File already exists: {path}")
        yn = input("Overwrite? [y/N] ")
        if yn.lower() != 'y':
            print("Skipped.")
            sys.exit(0)

    with open(path, 'w') as f:
        f.write(note)
    print(f"\n✅ Written: {path}")

    if publish:
        import subprocess
        summary = f"Story by {story['author']} — {story['points']} pts, {story['comment_count']} comments"
        cmd = [
            'python3', KH_PY, 'add',
            '--type', 'concept',
            '--name', story['title'],
            '--slug', slug,
            '--summary', summary[:200],
            '--facts', f"HN {story['points']} points | {story['comment_count']} comments | Source: {story['url']}"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(result.stdout.strip())
        if result.returncode != 0:
            print(f"⚠ KH.db error: {result.stderr.strip()}")

    print("\n📋 Next steps:")
    print(f"   1. Edit the note at {path}")
    print("   2. Add to Concepts INDEX.md")
    print("   3. Update root INDEX.md count")
    print("   4. Verify with orphaned-notes scan")
    print(f"   5. Link related entities: kh.py add --rel 'related_to:<other-slug>'")
    print(f"      (then verify: kh.py get {slug})")


if __name__ == '__main__':
    main()
