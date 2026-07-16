#!/usr/bin/env python3
"""Build the self-hosted Dutch word+definition data for Word Guesser.

Sources
  - Definitions: Dutch Wiktionary (nl.wiktionary.org) via kaikki.org's wiktextract
    dump (raw-wiktextract-data.jsonl.gz). Definitions are CC BY-SA 3.0 — see
    NL-DEFS-README.md for attribution (required).
  - Quality gate: OpenTaal wordlist.txt (approved Dutch words).

Policy ("balanced"): a word is kept iff it is valid for the game (see is_valid),
is present in the OpenTaal approved list, AND has a real Dutch definition in
Wiktionary (pure inflection pointers like "vervoeging van ..." do not count).
This means: words with no definition are dropped, and approved words missing from
the base list but carrying a real definition are added.

Outputs (written next to this script):
  - nl.txt        : one word per line (lowercase, accents kept) = keys of nl-defs.json
  - nl-defs.json  : { "word": "short definition", ... }
"""
import gzip, io, json, re, sys, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
WIKT_GZ = "https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz"
OPENTAAL = "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/wordlist.txt"
OUT_WORDS = HERE / "nl.txt"
OUT_DEFS = HERE / "nl-defs.json"
MAX_DEF = 180

def fold(w: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", w)
                   if unicodedata.category(c) != "Mn")

LETTERS = re.compile(r"[A-Za-z]+$")

def is_valid(w: str) -> bool:
    # mirror WordLists.clean(): no uppercase, folded length 4..8, letters only
    if any(c.isupper() for c in w):
        return False
    f = fold(w)
    return 4 <= len(f) <= 8 and bool(LETTERS.match(f))

# Glosses that are just morphology pointers, not real definitions.
INFL = re.compile(
    r"^(vervoeging|verbuiging|meervoud|enkelvoud|verkleinwoord|verkleinvorm|"
    r"(eerste|tweede|derde)\s+persoon|gebiedende\s+wijs|aanvoegende\s+wijs|"
    r"onvoltooid|voltooid|tegenwoordige|verleden|deelwoord|"
    r"overtreffende\s+trap|vergrotende\s+trap|bijvoeglijk\s+gebruik|"
    r"gietijzeren\s+vorm|zie\s|alternatieve?\s+(spelling|vorm))",
    re.IGNORECASE)

def real_def(sense: dict):
    if sense.get("form_of") or sense.get("alt_of"):
        return None
    gl = sense.get("glosses") or sense.get("raw_glosses")
    if not gl:
        return None
    g = re.sub(r"\s+", " ", gl[0]).strip()
    if not g or INFL.match(g):
        return None
    return g[:MAX_DEF].strip()

def load_universe() -> set:
    print("Downloading OpenTaal wordlist.txt …", flush=True)
    req = urllib.request.Request(OPENTAAL, headers={"User-Agent": "wordguesser-build"})
    uni = set()
    with urllib.request.urlopen(req) as r:
        for line in io.TextIOWrapper(r, encoding="utf-8"):
            w = line.strip()
            if w:
                uni.add(w.lower())
    print(f"  OpenTaal universe: {len(uni)} words", flush=True)
    return uni

def main():
    universe = load_universe()
    print("Streaming nlwiktionary dump (127 MB gz) …", flush=True)
    req = urllib.request.Request(WIKT_GZ, headers={"User-Agent": "wordguesser-build"})
    defs = {}
    seen = 0
    with urllib.request.urlopen(req) as resp:
        gz = gzip.GzipFile(fileobj=resp)
        for raw in io.TextIOWrapper(gz, encoding="utf-8"):
            seen += 1
            if seen % 200000 == 0:
                print(f"  … {seen} entries, {len(defs)} kept", flush=True)
            raw = raw.strip()
            if not raw:
                continue
            try:
                d = json.loads(raw)
            except Exception:
                continue
            if d.get("lang_code") != "nl":
                continue
            w = d.get("word", "")
            if not w:
                continue
            wl = w.lower()
            if wl in defs or not is_valid(w) or wl not in universe:
                continue
            for s in d.get("senses", []):
                g = real_def(s)
                if g:
                    defs[wl] = g
                    break
    words = sorted(defs)
    OUT_WORDS.write_text("\n".join(words) + "\n", encoding="utf-8")
    with open(OUT_DEFS, "w", encoding="utf-8") as f:
        json.dump(defs, f, ensure_ascii=False, sort_keys=True)
    print(f"Done: {len(words)} words with definitions", flush=True)
    print(f"  {OUT_WORDS.name}: {OUT_WORDS.stat().st_size} bytes", flush=True)
    print(f"  {OUT_DEFS.name}: {OUT_DEFS.stat().st_size} bytes", flush=True)

if __name__ == "__main__":
    main()
