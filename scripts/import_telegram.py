#!/usr/bin/env python3
"""
Simple Telegram JSON importer for memory-hybrid plugin (SQLite-only).
Usage: import_telegram.py /path/to/telegram_export.json [--db /path/to/facts.db]

Behavior:
- Read messages array from Telegram export JSON
- Extract text messages, sanitize, skip short/long, skip sensitive patterns
- Insert into facts DB if not duplicate

"""
import sys
import json
import re
from pathlib import Path
import sqlite3

SENSITIVE = re.compile(r"password|api.?key|secret|token|ssn|credit.?card", re.I)

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def main():
    if len(sys.argv) < 2:
        print("Usage: import_telegram.py /path/to/export.json [--db /path/to/facts.db]")
        return
    path = Path(sys.argv[1])
    dbpath = Path.home() / '.openclaw' / 'memory' / 'facts.db'
    if '--db' in sys.argv:
        dbpath = Path(sys.argv[sys.argv.index('--db') + 1])
    if not path.exists():
        print("file not found", path)
        return
    data = json.loads(path.read_text())
    msgs = []
    # Support both Telegram export shapes (messages or conversations)
    if 'messages' in data:
        for m in data['messages']:
            if not isinstance(m, dict):
                continue
            t = m.get('text') or m.get('content')
            if isinstance(t, str):
                msgs.append(t)
            elif isinstance(t, list):
                # Some exports are arrays of blocks
                parts = []
                for b in t:
                    if isinstance(b, str):
                        parts.append(b)
                    elif isinstance(b, dict) and 'text' in b:
                        parts.append(b['text'])
                if parts:
                    msgs.append(' '.join(parts))
    elif isinstance(data, list):
        for m in data:
            if isinstance(m, dict) and 'message' in m:
                msgs.append(m['message'])

    conn = sqlite3.connect(str(dbpath))
    c = conn.cursor()
    inserted = 0
    skipped = 0
    for t in msgs:
        txt = normalize(t)
        if len(txt) < 10 or len(txt) > 1000:
            skipped += 1
            continue
        if SENSITIVE.search(txt):
            skipped += 1
            continue
        # duplicate check
        c.execute("SELECT id FROM facts WHERE text = ? LIMIT 1", (txt,))
        if c.fetchone():
            skipped += 1
            continue
        # simple insert
        c.execute("INSERT INTO facts (id, text, category, importance, entity, key, value, source, created_at, decay_class, last_confirmed_at, confidence) VALUES (lower(hex(randomblob(16))), ?, 'conversation', 0.7, null, null, null, 'telegram-import', strftime('%s','now'), 'stable', strftime('%s','now'), 1.0)", (txt,))
        inserted += 1
    conn.commit()
    print(f"Inserted: {inserted}, Skipped: {skipped}")

if __name__ == '__main__':
    main()
