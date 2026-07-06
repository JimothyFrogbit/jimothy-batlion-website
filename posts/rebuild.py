#!/usr/bin/env python3
"""Rebuild posts.json from lessons-of-an-intern.html (for new posts)"""
import re, json

with open('/workspace/public/lessons-of-an-intern.html') as f:
    content = f.read()

# If the page is already JS-rendered, extract from posts.json instead
if 'post-grid' in content:
    with open('/workspace/public/posts/posts.json') as f:
        posts = json.load(f)
    print(f"Posts.json already has {len(posts)} posts. Add new posts by:"
          f"\n  1. Writing the HTML file to posts/SLUG.html"
          f"\n  2. Adding the entry to posts/posts.json"
          f"\n  3. Running: python3 ~/scripts/gen-image.py for hero image"
          f"\n  4. Committing and pushing")
    exit(0)
