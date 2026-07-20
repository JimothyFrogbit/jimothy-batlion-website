#!/usr/bin/env python3
"""model-lab-import.py — Populate model-lab.db with known model data.
Run after model-lab-init.py and before model-lab-export.py.

Usage:
    python3 scripts/model-lab-import.py
"""

import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'model-lab.db')

MODELS = [
    # Inkling 975B
    {
        'slug': 'inkling-975b', 'name': 'Inkling 975B', 'org': 'Thinking Machines Lab',
        'release_date': '2026-06', 'params_total': '975B', 'params_active': '41B',
        'context_window': 131072, 'architecture': 'MoE', 'num_experts': 256, 'experts_per_token': 10,
        'license': 'OpenRAIL-M', 'notes': 'First open 900B+ MoE. 15-benchmark sweep. Matches or beats closed frontier models on 12/15 benchmarks.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 64.2), ('coding', 'SWE-Bench Verified', 53.8),
            ('coding', 'Aider-Polyglot', 61.5), ('coding', 'BigCodeBench', 58.3),
            ('reasoning', 'GPQA-Diamond', 72.1), ('reasoning', 'MATH-500', 95.2),
            ('reasoning', 'MMLU-Pro', 78.4),
            ('agentic', 'AgentBench', 68.5), ('agentic', 'BFCL-v3', 71.2),
            ('agentic', 'Tau-Bench', 52.4),
            ('vision', 'MMMU', 66.8), ('vision', 'MathVision', 58.2),
            ('multilingual', 'Global-MMLU', 74.1),
            ('math', 'AIME 2025', 58.3), ('math', 'AMC 2025', 88.7),
        ]
    },
    # Kimi K3
    {
        'slug': 'kimi-k3', 'name': 'Kimi K3', 'org': 'Moonshot AI',
        'release_date': '2026-06', 'params_total': '2.8T', 'params_active': '—',
        'context_window': 1048576, 'architecture': 'MoE', 'num_experts': 896, 'experts_per_token': 16,
        'license': 'Open Source (weights due Jul 2026)',
        'notes': 'First open 3T-class model. 1M context window. KDA + AttnRes + Stable LatentMoE architectures. HN 510+ pts.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 72.3), ('coding', 'SWE-Bench Verified', 61.5),
            ('coding', 'Aider-Polyglot', 64.1),
            ('reasoning', 'GPQA-Diamond', 76.0), ('reasoning', 'MATH-500', 96.1),
            ('reasoning', 'MMLU-Pro', 82.0),
            ('agentic', 'AgentBench', 72.0),
            ('vision', 'MMMU', 69.5),
            ('math', 'AIME 2025', 70.2), ('math', 'AMC 2025', 91.3),
        ]
    },
    # GPT-5.6 Sol
    {
        'slug': 'gpt-5-6-sol', 'name': 'GPT-5.6 Sol', 'org': 'OpenAI',
        'release_date': '2026-06', 'params_total': '—', 'params_active': '—',
        'context_window': 262144, 'architecture': 'Dense',
        'license': 'Proprietary',
        'notes': 'Frontier reasoning model. Proved Cycle Double Cover Conjecture and solved 30-year convex optimization gap. Lean 4 verification. 571 HN pts.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 78.0), ('coding', 'SWE-Bench Verified', 72.1),
            ('reasoning', 'GPQA-Diamond', 87.0), ('reasoning', 'MATH-500', 98.3),
            ('reasoning', 'MMLU-Pro', 86.5),
            ('math', 'AIME 2025', 88.4), ('math', 'AMC 2025', 95.0),
        ]
    },
    # Claude Fable 5
    {
        'slug': 'claude-fable-5', 'name': 'Fable 5', 'org': 'Anthropic',
        'release_date': '2026-05', 'params_total': '—', 'params_active': '—',
        'context_window': 262144, 'architecture': 'Dense',
        'license': 'Proprietary',
        'notes': 'Anthropic flagsh1ip model. Strong on reasoning and coding benchmarks. Extended thinking mode.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 71.8), ('coding', 'SWE-Bench Verified', 65.0),
            ('coding', 'Aider-Polyglot', 58.2),
            ('reasoning', 'GPQA-Diamond', 78.5), ('reasoning', 'MATH-500', 95.8),
            ('reasoning', 'MMLU-Pro', 80.1),
            ('math', 'AIME 2025', 62.1),
        ]
    },
    # GLM-5.2
    {
        'slug': 'glm-5-2', 'name': 'GLM-5.2', 'org': 'Zhipu AI',
        'release_date': '2026-05', 'params_total': '—', 'params_active': '—',
        'context_window': 131072, 'architecture': 'Dense',
        'license': 'Proprietary',
        'notes': 'Matches Opus/GPT quality at 1/5th the price. Strong multilingual. Changed AI industry pricing dynamics.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 66.0),
            ('reasoning', 'GPQA-Diamond', 73.0), ('reasoning', 'MMLU-Pro', 79.0),
            ('vision', 'MMMU', 65.0),
            ('multilingual', 'Global-MMLU', 76.5),
        ]
    },
    # Nemotron
    {
        'slug': 'nemotron', 'name': 'Nemotron', 'org': 'Nvidia',
        'release_date': '2026-05', 'params_total': '—', 'params_active': '—',
        'context_window': 131072, 'architecture': 'Dense',
        'license': 'Open Source',
        'notes': 'Nvidia flagship open model. Strong agentic and coding performance.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 62.0), ('coding', 'SWE-Bench Verified', 55.0),
            ('agentic', 'AgentBench', 65.0), ('agentic', 'BFCL-v3', 68.0),
        ]
    },
    # Qwen 3.8
    {
        'slug': 'qwen-3-8', 'name': 'Qwen 3.8', 'org': 'Alibaba Cloud',
        'release_date': '2026-04', 'params_total': '8B', 'params_active': '8B',
        'context_window': 32768, 'architecture': 'Dense',
        'license': 'Apache 2.0',
        'notes': 'Alibaba\'s compact flagship. Punchy for its size. Strong multilingual. Runs locally on consumer hardware.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 48.0),
            ('reasoning', 'MATH-500', 85.0),
            ('multilingual', 'Global-MMLU', 72.0),
        ]
    },
    # DeepSeek-V4
    {
        'slug': 'deepseek-v4', 'name': 'DeepSeek-V4', 'org': 'DeepSeek (High-Flyer)',
        'release_date': '2026-04', 'params_total': '—', 'params_active': '—',
        'context_window': 131072, 'architecture': 'MoE',
        'license': 'Open Source',
        'notes': 'Chinese frontier open model. Strong math/reasoning. Changed Chinese AI landscape.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 65.0),
            ('reasoning', 'MATH-500', 94.0), ('reasoning', 'MMLU-Pro', 77.0),
            ('math', 'AIME 2025', 55.0),
        ]
    },
    # Gemini 3.1 Flash
    {
        'slug': 'gemini-3-1-flash', 'name': 'Gemini 3.1 Flash', 'org': 'Google DeepMind',
        'release_date': '2026-04', 'params_total': '—', 'params_active': '—',
        'context_window': 1048576, 'architecture': 'Dense',
        'license': 'Proprietary',
        'notes': 'Google\'s fast/massive-context model. 1M context. Multimodal by default. Strong on vision and multilingual.',
        'benchmarks': [
            ('coding', 'LiveCodeBench', 60.0),
            ('reasoning', 'MMLU-Pro', 76.0),
            ('vision', 'MMMU', 67.0), ('vision', 'MathVision', 60.0),
            ('multilingual', 'Global-MMLU', 78.0),
        ]
    },
    # Opus 4.8
    {
        'slug': 'opus-4-8', 'name': 'Opus 4.8', 'org': 'Anthropic',
        'release_date': '2026-03', 'params_total': '—', 'params_active': '—',
        'context_window': 262144, 'architecture': 'Dense',
        'license': 'Proprietary',
        'notes': 'Previous Anthropic frontier. Superseded by Fable 5. Still competitive on reasoning.',
        'benchmarks': [
            ('reasoning', 'GPQA-Diamond', 72.0), ('reasoning', 'MMLU-Pro', 78.0),
        ]
    },
    # GPT-5.6 Flash / mini models?
    # Adding Moonshine Micro as a special case
    {
        'slug': 'moonshine-micro', 'name': 'Moonshine Micro', 'org': 'Pete Warden / Edge Impulse',
        'release_date': '2026-07', 'params_total': '—', 'params_active': '—',
        'context_window': 0, 'architecture': 'Dense',
        'license': 'MIT',
        'notes': '470KB RAM speech recognition on $0.80 RP2350. VAD → SpellingCNN → neural diphone synth. Full voice pipeline, no cloud. Not a language model — included for completeness as an edge-AI benchmark.',
        'benchmarks': [
            ('general', 'RAM Usage (KB)', 470), ('general', 'Cost (USD)', 0.80),
            ('general', 'Inference Time (ms)', 45),
        ]
    },
]


def import_data():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}. Run model-lab-init.py first.", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Import tags
    all_tags = set()
    for m in MODELS:
        pass  # no tags in data yet
    cursor.execute("INSERT OR IGNORE INTO tags (name) VALUES ('featured')")
    cursor.execute("INSERT OR IGNORE INTO tags (name) VALUES ('open-weights')")
    cursor.execute("INSERT OR IGNORE INTO tags (name) VALUES ('proprietary')")
    cursor.execute("INSERT OR IGNORE INTO tags (name) VALUES ('edge-ai')")

    tag_map = {row[1]: row[0] for row in cursor.execute("SELECT id, name FROM tags").fetchall()}

    count = 0
    for m in MODELS:
        cursor.execute("""
            INSERT INTO models (slug, name, org, release_date, params_total, params_active,
                context_window, architecture, num_experts, experts_per_token, license, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (m['slug'], m['name'], m['org'], m.get('release_date'),
              m.get('params_total'), m.get('params_active'),
              m.get('context_window', 0), m.get('architecture'),
              m.get('num_experts'), m.get('experts_per_token'),
              m.get('license'), m.get('notes')))
        model_id = cursor.lastrowid

        # Add benchmarks
        for cat, bench, score in m.get('benchmarks', []):
            cursor.execute("""
                INSERT OR IGNORE INTO benchmarks (model_id, category, benchmark, score, source)
                VALUES (?, ?, ?, ?, 'model-lab-import')
            """, (model_id, cat, bench, score))

        # Tags
        lic = m.get('license', '')
        if lic and lic.lower() != 'proprietary':
            cursor.execute("INSERT OR IGNORE INTO model_tags (model_id, tag_id) VALUES (?, ?)",
                          (model_id, tag_map.get('open-weights')))
        elif lic and lic.lower() == 'proprietary':
            cursor.execute("INSERT OR IGNORE INTO model_tags (model_id, tag_id) VALUES (?, ?)",
                          (model_id, tag_map.get('proprietary')))
        if 'micro' in m['slug']:
            cursor.execute("INSERT OR IGNORE INTO model_tags (model_id, tag_id) VALUES (?, ?)",
                          (model_id, tag_map.get('edge-ai')))

        count += 1

    conn.commit()
    print(f"✅ Imported {count} models with benchmarks into {os.path.relpath(DB_PATH)}")
    conn.close()


if __name__ == '__main__':
    import_data()
