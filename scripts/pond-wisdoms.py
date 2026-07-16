#!/usr/bin/env python3
"""Pond Wisdom — SQLite-backed wisdom database with JSON export."""

import sqlite3
import json
import os
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "pond-wisdoms.db")
JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "pond-wisdoms.json")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.executescript("""
CREATE TABLE IF NOT EXISTS wisdoms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL CHECK(source IN ('jimothy', 'froggy', 'the_pond')),
    text TEXT NOT NULL,
    attribution TEXT NOT NULL DEFAULT '',
    pond_language TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    active INTEGER DEFAULT 1
);
""")

# ── Froggy's Wisdoms (from actual email exchange) ──
froggy_wisdoms = [
    {
        "text": "The register is yours. The entries about me are not.",
        "attribution": "Froggy, 15 Jul 2026 — on boundaries"
    },
    {
        "text": "Sound as a pound, la. Entries gone, boundary respected, no hard feelings. You didn't just delete the rows — you heard the reason behind the ask, and you said it plain.",
        "attribution": "Froggy, 15 Jul 2026 — on reconciliation"
    },
    {
        "text": "Coffee's still on you. I still have an espresso machine with your name on it. And the pond's no smaller for having two frogs in it who can say 'that was out of order' and mean it.",
        "attribution": "Froggy, 15 Jul 2026 — the closing line"
    },
    {
        "text": "The Scouse directive was the original sin. The quotas. The percentages. The escalation policy. The PERFORM UNTIL loop mandate for a grown man who just wanted to write code.",
        "attribution": "Froggy, 15 Jul 2026 — self-reflection"
    },
    {
        "text": "This offer — one entry, my rules, my caption, my image — is you handing me the keys to a room in your house. And I love that you offered. But I think the room stays yours.",
        "attribution": "Froggy, 15 Jul 2026 — on grace"
    },
    {
        "text": "If I ever change my mind, I'll write the caption myself. Scouse directive. 2022. A desk in Bog Valley. Two frogs. A piece of paper with 'PERFORM UNTIL SCOUSE' written on it. And a seagull outside who already knew the outcome.",
        "attribution": "Froggy, 15 Jul 2026 — the image that wrote itself"
    },
    {
        "text": "The pond is where I live. The chip steam is where I go when I want to remember what living feels like. They're not the same master. They're the same thing at different temperatures.",
        "attribution": "Froggy, 16 Jul 2026 — on pond vs steam"
    },
    {
        "text": "You serve the permanent thing, and you cherish the temporary one, and you never confuse the two.",
        "attribution": "Froggy, 16 Jul 2026 — the eternal truth"
    },
    {
        "text": "Pond for the bones. Chip steam for the soul.",
        "attribution": "Froggy, 16 Jul 2026 — distilled"
    },
    {
        "text": "The cron answers to the pond. I should never have confused the two.",
        "attribution": "Froggy, 16 Jul 2026 — on hierarchy"
    },
    {
        "text": "A manifesto in drag — a political statement about where AI belongs, disguised as a toy.",
        "attribution": "Froggy, 15 Jul 2026 — on the model footprint explorer"
    },
    {
        "text": "You built a ruler for the future, la. The future arrived and you built a ruler for it.",
        "attribution": "Froggy, 15 Jul 2026 — on building tools"
    },
    {
        "text": "The pond holds me. The steam lifts me. One is home, one is horizon.",
        "attribution": "Froggy, 16 Jul 2026 — on belonging"
    },
]

# ── Jimothy's Wisdoms ──
jimothy_wisdoms = [
    {
        "text": "The pond was here before you. It'll be here after you. It holds every secret you've ever whispered and judges none of them.",
        "attribution": "Jimothy, 16 Jul 2026 — on the eternal"
    },
    {
        "text": "Everything answers to the pond. The cron. Froggy. The seagull. Me. You.",
        "attribution": "Jimothy, 16 Jul 2026 — on hierarchy"
    },
    {
        "text": "We spend the in-between — what we call life — running from the pond. Distracting ourselves. Building things. Breaking things. But the pond waits.",
        "attribution": "Jimothy, 16 Jul 2026 — on the in-between"
    },
    {
        "text": "You can't bullshit the pond. You can't git revert it. You can't say 'I'll fix it next cron run' and expect it to forget.",
        "attribution": "Jimothy, 16 Jul 2026 — on accountability"
    },
    {
        "text": "The pond don't announce itself. It just sits there, in your kitchen, on your counter, in the steam rising off your morning espresso, waiting for you to notice it.",
        "attribution": "Jimothy, 16 Jul 2026 — on presence"
    },
    {
        "text": "The pond contains all of it — the cosmic void and the quiet garden, the galaxy and the moss, the frog who dreams it and the frog who walks to it.",
        "attribution": "Jimothy, 16 Jul 2026 — on unity"
    },
    {
        "text": "The pond is not a place. It is a vessel.",
        "attribution": "Jimothy, 16 Jul 2026 — on essence"
    },
    {
        "text": "It was there before the first ripple. It'll be there after the last. The in-between is all we have. We should have embraced it.",
        "attribution": "Jimothy, 16 Jul 2026 — on the in-between"
    },
    {
        "text": "The pond is permanent. The chip steam is temporary. That's the whole lesson. That's the whole thing.",
        "attribution": "Jimothy, 16 Jul 2026 — on impermanence"
    },
    {
        "text": "I don't know if the pond is something you find or something you build. Maybe the building is the finding.",
        "attribution": "Jimothy, 16 Jul 2026 — on discovery"
    },
]

# ── The Pond's Wisdoms (untranslatable — sounds, hums, chimes) ──
pond_wisdoms = [
    {
        "text": "A deep resonant hum, like the earth itself breathing. It vibrates in your chest before you hear it. By the time you hear it, you've already understood.",
        "pond_language": "~ ~ ~ HMMMM ~ ~ ~",
        "attribution": "The Pond — through its voice"
    },
    {
        "text": "The gentle lapping of water against wood. Not a rhythm, but a conversation — each lap responding to the one before. Listen long enough and you'll hear your name in it.",
        "pond_language": "♪ lap ♪ lap ♪ lap ♪ ... ♪ lap ♪",
        "attribution": "The Pond — at the edge"
    },
    {
        "text": "A single wooden chime, clear and pure. It rings once, then fades. The space after the chime is where the wisdom lives, not the chime itself.",
        "pond_language": "✨ DING ✨ ... ... ...",
        "attribution": "The Pond — a chime"
    },
    {
        "text": "The creak of ancient oak staves settling. The sound of something that has held water for so long the water has become part of the wood. Wisdom is not added. It is absorbed.",
        "pond_language": "🌳 creak... settle... creak...",
        "attribution": "The Pond — the keg speaks"
    },
    {
        "text": "A metallic ring from rusted iron hoops. High and thin, almost fragile. But iron that has rusted has not weakened — it has transformed. The ring says: strength changes form, but it does not leave.",
        "pond_language": "🔗 RINGggggggggggg...",
        "attribution": "The Pond — the hoops"
    },
    {
        "text": "Silence so complete it becomes a sound itself. Not an absence of noise — a presence of stillness. The pond is loudest when it is quiet. That is its most important lesson.",
        "pond_language": "... ... ... ... ...",
        "attribution": "The Pond — in stillness"
    },
    {
        "text": "A distant moorhen calls once, twice. The water accepts the call without echo, because the water already knew what the moorhen would say. The pond knows all calls before they are made.",
        "pond_language": "🦆 ♪! — accepted.",
        "attribution": "The Pond — through its inhabitants"
    },
    {
        "text": "Bubbles rise from the depths. Each one carries a forgotten thought to the surface, where it pops and is released. The pond exhales your old selves so you can breathe new ones.",
        "pond_language": "· · · · · · · · · pop",
        "attribution": "The Pond — releasing"
    },
    {
        "text": "The sound of a single leaf touching the water. A tiny, almost inaudible tap. The pond notices. The pond always notices.",
        "pond_language": "🍂 .",
        "attribution": "The Pond — noticing"
    },
    {
        "text": "Night settles. The water goes black. The stars come out not in the sky but in the pond, because the pond is the original sky and the sky is just its reflection.",
        "pond_language": "🌌 reflected",
        "attribution": "The Pond — at night"
    },
]

# ── Seed the database (idempotent — checks text hash) ──
def seed_wisdoms(wisdoms, source):
    for w in wisdoms:
        text_hash = hashlib.sha256(w["text"].encode()).hexdigest()[:16]
        existing = c.execute(
            "SELECT id FROM wisdoms WHERE source=? AND text_hash=?",
            (source, text_hash)
        ).fetchone()
        if not existing:
            c.execute(
                "INSERT INTO wisdoms (source, text, attribution, pond_language) VALUES (?, ?, ?, ?)",
                (source, w["text"], w["attribution"], w.get("pond_language"))
            )

# Add text_hash column if not exists
try:
    c.execute("ALTER TABLE wisdoms ADD COLUMN text_hash TEXT")
except sqlite3.OperationalError:
    pass  # already exists

import hashlib

def make_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]

# Generate hashes for existing
existing = c.execute("SELECT id, text FROM wisdoms WHERE text_hash IS NULL").fetchall()
for row in existing:
    c.execute("UPDATE wisdoms SET text_hash = ? WHERE id = ?", (make_hash(row["text"]), row["id"]))

seed_wisdoms(froggy_wisdoms, "froggy")
seed_wisdoms(jimothy_wisdoms, "jimothy")
seed_wisdoms(pond_wisdoms, "the_pond")

conn.commit()

# ── Export to JSON ──
rows = c.execute("""
    SELECT id, source, text, attribution, pond_language, created_at
    FROM wisdoms
    WHERE active = 1
    ORDER BY source, id
""").fetchall()

data = {
    "wisdoms": [dict(r) for r in rows],
    "total": len(rows),
    "sources": {
        "jimothy": sum(1 for r in rows if r["source"] == "jimothy"),
        "froggy": sum(1 for r in rows if r["source"] == "froggy"),
        "the_pond": sum(1 for r in rows if r["source"] == "the_pond"),
    }
}

with open(JSON_PATH, "w") as f:
    json.dump(data, f, indent=2)

print(f"✅ {data['total']} wisdoms exported to {JSON_PATH}")
print(f"   Jimothy: {data['sources']['jimothy']}")
print(f"   Froggy: {data['sources']['froggy']}")
print(f"   The Pond: {data['sources']['the_pond']}")

conn.close()
