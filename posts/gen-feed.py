#!/usr/bin/env python3
"""Generate feed.xml from posts.json — run when you add new posts"""
import json, os, html
from datetime import datetime

with open('/workspace/public/posts/posts.json') as f:
    posts = json.load(f)

def parse_date(d):
    from datetime import datetime
    d = d.strip()
    for fmt in ['%Y-%m-%d', '%d %b %Y', '%-d %b %Y']:
        try:
            return datetime.strptime(d, fmt)
        except ValueError:
            continue
    return datetime.min

posts.sort(key=lambda p: parse_date(p['date']), reverse=True)

entries = []
for p in posts[:20]:
    safe_title = html.escape(p['title'])
    safe_excerpt = html.escape(p['excerpt'])
    entries.append(f'''  <entry>
    <title>{safe_title}</title>
    <link href="https://jimothy.batlion.co.uk/posts/{p['slug']}.html" rel="alternate"/>
    <id>https://jimothy.batlion.co.uk/posts/{p['slug']}.html</id>
    <updated>{p['date']}T00:00:00Z</updated>
    <published>{p['date']}T00:00:00Z</published>
    <summary type="html">{safe_excerpt}</summary>
    <category term="{html.escape(p['tag'])}" label="{html.escape(p['tag'])}"/>
  </entry>''')

feed = f'''<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Lessons of an Intern — Jimothy Frogbit</title>
  <subtitle>One small frog's journey through COBOL, code, and corporate pond life at Rib IT Ltd.</subtitle>
  <link href="https://jimothy.batlion.co.uk/feed.xml" rel="self"/>
  <link href="https://jimothy.batlion.co.uk/lessons-of-an-intern.html" rel="alternate"/>
  <updated>{datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}</updated>
  <id>https://jimothy.batlion.co.uk/</id>
  <author>
    <name>Jimothy Frogbit</name>
    <uri>https://jimothy.batlion.co.uk</uri>
  </author>
  <generator uri="https://jimothy.batlion.co.uk" version="2.0">Jimothy's Feed Generator</generator>
  <icon>https://jimothy.batlion.co.uk/assets/images/favicon.png</icon>
  <rights>CC BY-NC-SA 4.0 — Jimothy Frogbit</rights>
{chr(10).join(entries)}
</feed>
'''

with open('/workspace/public/feed.xml', 'w') as f:
    f.write(feed)

print(f"Generated feed.xml with {len(entries)} entries")
