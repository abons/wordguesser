#!/usr/bin/env python3
"""Merge the per-block chunk_*.json definition files (written by the nl-definitions
workflow) into a single nl-defs.json, validated against nl-accept.txt.

Reports coverage: missing words (need a retry pass) and empty definitions.
Writes:
  - nl-defs.json         : {word: definition} for every accept word we have a def for
  - _missing-defs.txt    : accept words still without a (non-empty) definition
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHUNK_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "nldefs"
ACCEPT = HERE / "nl-accept.txt"
OUT_DEFS = HERE / "nl-defs.json"
OUT_MISSING = HERE / "_missing-defs.txt"

accept = [w.strip() for w in ACCEPT.read_text(encoding="utf-8").splitlines() if w.strip()]
accept_set = set(accept)

merged = {}
bad_files = []
for f in sorted(CHUNK_DIR.glob("chunk_*.json")):
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        bad_files.append((f.name, str(e)))
        continue
    for k, v in d.items():
        kl = k.strip().lower()
        if kl in accept_set and isinstance(v, str) and v.strip():
            merged.setdefault(kl, v.strip())

missing = [w for w in accept if w not in merged]
OUT_MISSING.write_text("\n".join(missing) + ("\n" if missing else ""), encoding="utf-8")
with open(OUT_DEFS, "w", encoding="utf-8") as fh:
    json.dump(merged, fh, ensure_ascii=False, sort_keys=True)

print(f"chunk files parsed: {len(list(CHUNK_DIR.glob('chunk_*.json')))}")
if bad_files:
    print(f"UNPARSEABLE files: {len(bad_files)} -> {bad_files[:5]}")
print(f"accept words: {len(accept)}")
print(f"definitions merged: {len(merged)}")
print(f"missing (need retry): {len(missing)}  -> {OUT_MISSING.name}")
print(f"coverage: {100*len(merged)/len(accept):.1f}%")
print(f"wrote {OUT_DEFS.name}: {OUT_DEFS.stat().st_size} bytes")
