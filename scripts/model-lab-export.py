#!/usr/bin/env python3
"""model-lab-export.py — Generate JSON for the Model Lab Vue page.
Reads model-lab.db, outputs model-lab-data.json consumed by /tools/model-lab.html.

Usage:
    python3 scripts/model-lab-export.py
    → writes /workspace/public/data/model-lab-data.json
"""

import json
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'model-lab.db')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'model-lab-data.json')

def export():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}. Run model-lab-init.py first.", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Fetch all models via the view
    cursor.execute("SELECT * FROM v_model_export ORDER BY release_date DESC")
    rows = cursor.fetchall()

    models = []
    for row in rows:
        model = dict(row)
        # Parse the JSON benchmarks string into a list
        if isinstance(model['benchmarks'], str):
            model['benchmarks'] = json.loads(model['benchmarks'])
        models.append(model)

    # Build tag index
    cursor.execute("""
        SELECT t.name, GROUP_CONCAT(mt.model_id) as model_ids
        FROM tags t
        JOIN model_tags mt ON mt.tag_id = t.id
        GROUP BY t.name
    """)
    tags = {}
    for row in cursor.fetchall():
        tags[row['name']] = [int(x) for x in row['model_ids'].split(',')]

    # Build category index from benchmarks
    cursor.execute("SELECT DISTINCT category FROM benchmarks ORDER BY category")
    categories = [row['category'] for row in cursor.fetchall()]

    output = {
        'models': models,
        'tags': tags,
        'categories': categories,
        'meta': {
            'model_count': len(models),
            'benchmark_count': cursor.execute("SELECT COUNT(*) FROM benchmarks").fetchone()[0],
            'generated_at': __import__('datetime').datetime.now().isoformat()
        }
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✅ Exported {len(models)} models, {output['meta']['benchmark_count']} benchmarks → {os.path.relpath(OUT_PATH)}")
    conn.close()

if __name__ == '__main__':
    export()
