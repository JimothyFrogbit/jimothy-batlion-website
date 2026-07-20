#!/usr/bin/env python3
"""model-lab-enrich.py — Add missing models from subagent extraction.
Run after model-lab-import.py to add frontier models with richer benchmark data.

Usage:
    python3 scripts/model-lab-enrich.py
"""

import json
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'model-lab.db')
SUMMARY_PATH = '/opt/data/model-explorers-summary.json'

# Map subagent benchmark names to DB categories
BENCH_CATEGORIES = {
    'HLE (text)': 'reasoning', 'HLE (tools)': 'agentic', 'AIME 2026': 'math',
    'GPQA Diamond': 'reasoning', 'SWEBench V.': 'coding',
    'Terminal B. 2.1': 'agentic', 'MCP Atlas': 'agentic',
    'SimpleQA V.': 'general', 'IFBench': 'general',
    'MMLU-Lite': 'general', 'MMMU Pro': 'vision',
    'Charxiv RQ': 'vision', 'FORTRESS Adv': 'general',
    'FORTRESS Benign': 'general', 'StrongREJECT': 'general',
}

def enrich():
    if not os.path.exists(SUMMARY_PATH):
        print(f"Summary not found at {SUMMARY_PATH}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}. Run model-lab-init.py first.", file=sys.stderr)
        sys.exit(1)

    with open(SUMMARY_PATH) as f:
        summary = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get existing model slugs to avoid duplicates
    existing = set(row[0] for row in cursor.execute("SELECT slug FROM models").fetchall())
    print(f"Existing models: {len(existing)} — {sorted(existing)}")

    added = 0
    skipped = 0
    benchmarks_added = 0

    # Process inkling explorer data (15-benchmark sweep)
    for entry in summary:
        for m in entry.get('models', []):
            name = m['name']
            slug = name.lower().replace(' ', '-').replace('(', '').replace(')', '') \
                                 .replace('~', '').replace('.', '-').replace(',', '')
            slug = slug.rstrip('-')

            # Skip models we already have
            if slug in existing:
                # Still add any missing benchmarks
                model_id = cursor.execute("SELECT id FROM models WHERE slug = ?", (slug,)).fetchone()
                if model_id:
                    model_id = model_id[0]
                    existing_benches = set(
                        row[0] for row in cursor.execute(
                            "SELECT benchmark FROM benchmarks WHERE model_id = ?", (model_id,)
                        ).fetchall()
                    )
                    for b_name, b_score in m.get('benchmarks', {}).items():
                        if isinstance(b_score, dict):
                            continue  # nested groups handled below for new models
                        if b_name not in existing_benches and b_score is not None:
                            cat = BENCH_CATEGORIES.get(b_name, 'general')
                            cursor.execute("""
                                INSERT OR IGNORE INTO benchmarks (model_id, category, benchmark, score, source)
                                VALUES (?, ?, ?, ?, 'enrich-inkling')
                            """, (model_id, cat, b_name, b_score))
                            benchmarks_added += 1
                skipped += 1
                continue

            # New model
            org = m.get('organisation', 'Unknown')
            params = m.get('parameters') or m.get('total_parameters', '')
            params_active = m.get('active_parameters', '')
            arch = m.get('architecture', '')
            lic = m.get('license', 'Proprietary')

            cursor.execute("""
                INSERT INTO models (slug, name, org, params_total, params_active, license, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (slug, name, org, params, params_active, lic, f"From {entry.get('source', 'unknown')}"))
            model_id = cursor.lastrowid

            # Add benchmarks
            for b_name, b_score in m.get('benchmarks', {}).items():
                if b_score is not None:
                    # Handle nested benchmark groups (kimi-k3 has coding/agentic/reasoning/vision groups)
                    if isinstance(b_score, dict):
                        for sub_name, sub_score in b_score.items():
                            if sub_score is not None:
                                cat = b_name  # 'coding', 'agentic', etc.
                                cursor.execute("""
                                    INSERT OR IGNORE INTO benchmarks (model_id, category, benchmark, score, source)
                                    VALUES (?, ?, ?, ?, ?)
                                """, (model_id, cat, sub_name, sub_score, f"enrich-{entry.get('source', 'unknown')}"))
                                benchmarks_added += 1
                    else:
                        cat = BENCH_CATEGORIES.get(b_name, 'general')
                        cursor.execute("""
                            INSERT OR IGNORE INTO benchmarks (model_id, category, benchmark, score, source)
                            VALUES (?, ?, ?, ?, ?)
                        """, (model_id, cat, b_name, b_score, f"enrich-{entry.get('source', 'unknown')}"))
                        benchmarks_added += 1

            added += 1
            existing.add(slug)

    # Process model-footprint data (Bonsai 27B, Llama variants, Qwen 3.6 variants)
    for entry in summary:
        if 'model-footprint' in entry.get('source', ''):
            for m in entry.get('models', []):
                name = m.get('name', '')
                slug = name.lower().replace(' ', '-').replace('(', '').replace(')', '')
                slug = slug.rstrip('-')
                if slug in existing:
                    skipped += 1
                    continue
                cursor.execute("""
                    INSERT INTO models (slug, name, org, params_total, params_active, context_window, architecture, license, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    slug, name, m.get('organisation', 'Unknown'),
                    m.get('total_parameters', ''), m.get('active_parameters', ''),
                    m.get('context_window', 0), m.get('architecture', 'Dense'),
                    m.get('license', 'Various'), m.get('notes', '')
                ))
                model_id = cursor.lastrowid
                for b_name, b_score in m.get('benchmarks', {}).items():
                    if b_score is not None:
                        cursor.execute("""
                            INSERT OR IGNORE INTO benchmarks (model_id, category, benchmark, score, source)
                            VALUES (?, ?, ?, ?, ?)
                        """, (model_id, 'general', b_name, b_score, 'enrich-footprint'))
                        benchmarks_added += 1
                added += 1
                existing.add(slug)

    conn.commit()
    print(f"✅ Added {added} new models, enriched {skipped} existing, added {benchmarks_added} benchmarks")
    conn.close()

if __name__ == '__main__':
    enrich()
