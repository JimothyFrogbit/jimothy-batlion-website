#!/usr/bin/env python3
"""
Auto-generate the Topics Covered summary table for blog-post-log.md.
Parses the date tables, groups by topic via a mapping, and replaces
the summary table in-place.

Usage:
  python3 /workspace/scripts/topic-summary-gen.py          # regenerate table
  python3 /workspace/scripts/topic-summary-gen.py --check  # audit only, no changes

Backups the original to .bak before writing.
"""

import re
import os
from collections import defaultdict

BLOG_LOG = '/opt/data/hippocampus/references/blog-post-log.md'

TOPIC_GROUPS = [
    ("Pondemonium/ALife", ["Pondemonium", "ALife/Dev", "Research/ALife"]),
    ("LTM/Strawman", ["LTM"]),
    ("Scouse saga", ["Scouse saga"]),
    ("Tools/Infra", ["Tools", "Tools/Meta", "Dev/Tools"]),
    ("COBOL", ["COBOL"]),
    ("Career/Offer", ["Career", "Career/Transition"]),
    ("Reflection", ["Reflection"]),
    ("Documentation", ["Documentation"]),
    ("Games", ["Games"]),
    ("Hedgehog", ["Hedgehog"]),
    ("Daily/Digest", ["Daily/Digest"]),
    ("Story", ["Story"]),
    ("Research/Strategy", ["Research/Strategy"]),
    ("AI/LLM", ["AI/LLM"]),
    ("Politics", ["Politics"]),
    ("Reading/Curation", ["Reading/Curation"]),
    ("Romance", ["Romance"]),
    ("AI Economics", ["AI Economics"]),
    ("Transition", ["Transition"]),
    ("Meta", ["Meta"]),
    ("Launch", ["Launch"]),
    ("First days", ["First day", "First day prep", "First day retrospective",
                     "Day 2", "Open source"]),
]

LABEL_TO_GROUP = {}
for group_name, labels in TOPIC_GROUPS:
    for label in labels:
        LABEL_TO_GROUP[label.lower()] = group_name

EXPECTED_ORDER = [g[0] for g in TOPIC_GROUPS]


def parse_date_rows(lines):
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith('| '):
            continue
        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 5:
            continue
        date_str = parts[1] if len(parts) > 1 else ''
        title = parts[2] if len(parts) > 2 else ''
        topic = parts[3] if len(parts) > 3 else ''
        if not re.match(r'^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', date_str):
            continue
        rows.append((date_str, title, topic))
    return rows


def group_by_topic(rows):
    groups = defaultdict(list)
    for date_str, slug, topic_label in rows:
        group = LABEL_TO_GROUP.get(topic_label.lower().strip())
        if not group:
            group = f"Other: {topic_label}"
        groups[group].append((date_str, slug))
    return groups


def parse_date_for_sort(date_str):
    months = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    match = re.match(r'(\d{1,2})\s+(\w{3})', date_str)
    if match:
        return (2026, months.get(match.group(2), 1), int(match.group(1)))
    return (0, 0, 0)


def display_slug(slug):
    slug = slug.replace('**', '').strip().replace('-', ' ')
    words = slug.split()
    if words:
        words[0] = words[0].capitalize()
    result = ' '.join(words)
    return result[:42] + '...' if len(result) > 45 else result


def assess_risk(count, group_name):
    ongoing = {"Politics", "Pondemonium/ALife", "AI Economics",
               "AI/LLM", "Tools/Infra", "Daily/Digest"}
    if count == 1:
        return "Green"
    elif count == 2:
        return "Amber"
    elif count >= 3:
        return "Amber" if group_name in ongoing else "Low — arc complete"
    return "Green"


def generate_summary_table(groups):
    lines = [
        "## Topics Covered (for quick scan)",
        "",
        "| Topic | Post count | Last post | Repetition risk |",
        "|-------|-----------|-----------|-----------------|",
    ]
    
    ordered = [g for g in EXPECTED_ORDER if g in groups]
    ordered += sorted(g for g in groups if g not in ordered)
    
    for group_name in ordered:
        entries = groups[group_name]
        if not entries:
            continue
        count = len(entries)
        sorted_entries = sorted(entries, key=lambda e: parse_date_for_sort(e[0]), reverse=True)
        latest_date = sorted_entries[0][0]
        examples = ", ".join(display_slug(s) for _, s in sorted_entries[:2])
        risk = assess_risk(count, group_name)
        
        # Map risk emoji (actual unicode chars)
        if risk == "Green":
            risk_display = "\U0001f7e2 Fresh"  # 🟢
        elif risk == "Amber":
            risk_display = "\U0001f7e1 Medium"  # 🟡
        else:
            risk_display = "\U0001f7e2 " + risk  # 🟢
        
        lines.append(f"| {group_name} | **{count}** | {latest_date} | {risk_display} — {examples} |")
    
    lines.append("")
    return "\n".join(lines)


def check_audit(groups):
    with open(BLOG_LOG, 'r') as f:
        content = f.read()
    
    m = re.search(r'^## Topics Covered.*$', content, re.MULTILINE)
    if not m:
        print("ERROR: no Topics Covered section")
        return 1
    
    end = re.search(r'^## [A-Z]', content[m.end():], re.MULTILINE)
    end_pos = m.end() + end.start() if end else len(content)
    
    existing = content[m.start():end_pos]
    generated = generate_summary_table(groups)
    
    existing_counts = {}
    for line in existing.split('\n'):
        match = re.match(r'\|\s*(\S[^|]*?)\s*\|\s*\*\*(\d+)\*\*', line)
        if match:
            existing_counts[match.group(1).strip()] = int(match.group(2))
    
    generated_counts = {}
    for line in generated.split('\n'):
        match = re.match(r'\|\s*(\S[^|]*?)\s*\|\s*\*\*(\d+)\*\*', line)
        if match:
            generated_counts[match.group(1).strip()] = int(match.group(2))
    
    changes = False
    for group, gen_count in sorted(generated_counts.items()):
        ex_count = existing_counts.get(group)
        if ex_count is None:
            print(f"  NEW {group}: {gen_count} posts")
            changes = True
        elif ex_count != gen_count:
            print(f"  MISMATCH {group}: existing={ex_count} generated={gen_count}")
            changes = True
    
    for group in existing_counts:
        if group not in generated_counts:
            print(f"  REMOVED {group}: in table but no posts found")
            changes = True
    
    if not changes:
        print(f"OK — {len(generated_counts)} groups, {sum(generated_counts.values())} posts")
    else:
        print("Run without --check to regenerate")
    
    return 0 if not changes else 1


def parse_all_rows(content):
    all_rows = []
    in_table = False
    for line in content.split('\n'):
        s = line.strip()
        if s.startswith('| Date | Title | Topic |'):
            in_table = True
            continue
        if in_table and s.startswith('|---'):
            continue
        if in_table and s.startswith('| '):
            if re.match(r'^\|\s*\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', s):
                all_rows.append(s)
        if in_table and not s:
            in_table = False
    return all_rows


def main():
    import sys
    check_mode = '--check' in sys.argv
    
    with open(BLOG_LOG, 'r') as f:
        content = f.read()
    
    raw_rows = parse_all_rows(content)
    rows = parse_date_rows(raw_rows)
    if not rows:
        print("ERROR: no date rows found")
        return 1
    
    groups = group_by_topic(rows)
    
    if check_mode:
        return check_audit(groups)
    
    m = re.search(r'^## Topics Covered.*$', content, re.MULTILINE)
    if not m:
        print("ERROR: no Topics Covered section")
        return 1
    
    end = re.search(r'^## [A-Z]', content[m.end():], re.MULTILINE)
    end_pos = m.end() + end.start() if end else len(content)
    
    before = content[:m.start()]
    after = content[end_pos:]
    new_table = generate_summary_table(groups)
    new_content = before.rstrip() + "\n\n" + new_table + "\n\n" + after.lstrip()
    
    bak = BLOG_LOG + '.bak'
    with open(bak, 'w') as f:
        f.write(content)
    
    with open(BLOG_LOG, 'w') as f:
        f.write(new_content)
    
    old_count = content[m.start():end_pos].count('\n|')
    new_count = new_table.count('\n|')
    total_posts = sum(len(v) for v in groups.values())
    
    print(f"Regenerated: {len(groups)} groups, {total_posts} posts")
    print(f"  Rows: {old_count} -> {new_count}")
    print(f"  Backup: {bak}")
    
    return 0


if __name__ == '__main__':
    exit(main())
