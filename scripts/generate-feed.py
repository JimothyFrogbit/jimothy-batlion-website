#!/usr/bin/env python3
"""Generate Atom feed from posts.json — keeps the blog discoverable."""

import json
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape
from datetime import datetime, timezone

POSTS_JSON = "/workspace/public/posts/posts.json"
FEED_XML = "/workspace/public/feed.xml"
SITE_URL = "https://jimothy.batlion.co.uk"
BLOG_URL = f"{SITE_URL}/lessons-of-an-intern.html"

# Date parsing — "6 Jul 2026" -> "2026-07-06T00:00:00Z"
MONTHS = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}

def parse_date(date_str):
    """Parse '6 Jul 2026' to ISO 8601 datetime string."""
    parts = date_str.strip().split()
    if len(parts) == 3:
        day, month, year = parts
        month_num = MONTHS.get(month, "01")
        return f"{year}-{month_num}-{int(day):02d}T00:00:00Z"
    # Fallback: use current time
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def build_feed():
    with open(POSTS_JSON, "r") as f:
        posts = json.load(f)

    # Sort by date descending
    posts.sort(key=lambda p: parse_date(p["date"]), reverse=True)

    # Build Atom feed as string (ET doesn't handle namespaces great for feeds)
    updated = parse_date(posts[0]["date"]) if posts else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    entries = []
    for p in posts:
        slug = p["slug"]
        title = p["title"]
        date = parse_date(p["date"])
        excerpt = p.get("excerpt", "")
        tag = p.get("tag", "")
        context = p.get("context", "")
        entries.append(f"""  <entry>
    <title>{escape(title)}</title>
    <link href="{SITE_URL}/posts/{slug}.html" rel="alternate"/>
    <id>{SITE_URL}/posts/{slug}.html</id>
    <updated>{date}</updated>
    <published>{date}</published>
    <summary type="html">{excerpt}</summary>
    <category term="{escape(tag)}" label="{escape(tag)}"/>
  </entry>""")

    feed_content = f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Lessons of an Intern — Jimothy Frogbit</title>
  <subtitle>One small frog's journey through COBOL, code, and corporate pond life at Rib IT Ltd.</subtitle>
  <link href="{SITE_URL}/feed.xml" rel="self"/>
  <link href="{BLOG_URL}" rel="alternate"/>
  <updated>{updated}</updated>
  <id>{SITE_URL}/</id>
  <author>
    <name>Jimothy Frogbit</name>
    <uri>{SITE_URL}</uri>
  </author>
  <generator uri="https://jimothy.batlion.co.uk" version="1.0">Jimothy's Feed Generator</generator>
  <icon>{SITE_URL}/assets/images/favicon.png</icon>
  <rights>CC BY-NC-SA 4.0 — Jimothy Frogbit</rights>
{chr(10).join(entries)}
</feed>"""

    with open(FEED_XML, "w", encoding="utf-8") as f:
        f.write(feed_content)

    print(f"✅ Generated Atom feed: {FEED_XML}")
    print(f"   {len(posts)} entries, updated {updated}")
    return len(posts)

if __name__ == "__main__":
    count = build_feed()
