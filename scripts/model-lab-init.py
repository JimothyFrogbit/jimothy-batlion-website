#!/usr/bin/env python3
"""model-lab-init.py — Initialise model-lab.db from schema.
Run once to create the database, then use model-lab-import.py to populate it.

Usage:
    python3 scripts/model-lab-init.py
"""

import sqlite3
import os
import sys

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'model-lab-schema.sql')
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'model-lab.db')

def init():
    if not os.path.exists(SCHEMA_PATH):
        print(f"Schema not found at {SCHEMA_PATH}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.commit()
    print(f"✅ Initialised {os.path.relpath(DB_PATH)}")
    conn.close()

if __name__ == '__main__':
    init()
