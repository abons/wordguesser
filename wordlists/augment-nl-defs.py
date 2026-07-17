#!/usr/bin/env python3
"""Augment nl-defs.json with definitions for the BASE words that formulaic form-of
glosses point to but that fall outside the game's 4-8 length filter.

Many accepted words are pure inflection pointers, e.g.
  "verkende" -> "enkelvoud verleden tijd van verkennen"
The app resolves these to the base word's real definition on "?" (see
MainActivity.resolveFormOf). That only works when the base ("verkennen", 9 letters)
is present in the def map — but the build filters words to length 4-8, so long
infinitives / short nouns never made it in.

This adds ONLY those referenced base words to nl-defs.json (real Wiktionary glosses
only, never another pointer). It does NOT touch nl.txt / nl-accept.txt: the bases are
resolution targets only, never valid guesses or answers.

Source: Dutch Wiktionary via kaikki.org (CC BY-SA 3.0) — same as build-nl-defs.py.
"""
import gzip, io, json, re, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
WIKT_GZ = "https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz"
DEFS = HERE / "nl-defs.json"
MAX_DEF = 180

# --- form-of detection: mirrors MainActivity.FORM_OF_WORDS / formOfBase exactly. ---
FORM_OF_WORDS = set("""
van de het eerste tweede derde persoon enkelvoud meervoud tegenwoordige verleden tijd
voltooid onvoltooid deelwoord verbogen onverbogen vorm stellende vergrotende overtreffende
trap partitief genitief datief nominatief accusatief aanvoegende gebiedende wijs vervoeging
verbuiging beklemtoonde onbeklemtoonde nadrukkelijke onnadrukkelijke onzijdig mannelijk
vrouwelijk mannelijke vrouwelijke onpersoonlijke persoonlijke verkleinvorm verkleinwoord
verkorting verouderde oude dialectvorm dialectische schrijfwijze spelling spellingvariant
spellingsvariant zelfstandig naamwoord bijvoeglijk werkwoord bijwoord telwoord
""".split())

def form_of_base(gloss: str):
    t = gloss.strip().rstrip(".")
    i = t.lower().rfind(" van ")
    if i < 0:
        return None
    base = t[i + 5:].strip().lower()
    if not base or " " in base:
        return None
    words = [w for w in t[:i].lower().split() if w]
    if not words or any(w not in FORM_OF_WORDS for w in words):
        return None
    return base

# --- real-vs-pointer gloss picking: mirrors build-nl-defs.py. ---
INFL = re.compile(
    r"^(vervoeging|verbuiging|meervoud|enkelvoud|verkleinwoord|verkleinvorm|"
    r"(eerste|tweede|derde)\s+persoon|gebiedende\s+wijs|aanvoegende\s+wijs|"
    r"onvoltooid|voltooid|tegenwoordige|verleden|deelwoord|"
    r"overtreffende\s+trap|vergrotende\s+trap|bijvoeglijk\s+gebruik|"
    r"gietijzeren\s+vorm|zie\s|alternatieve?\s+(spelling|vorm))",
    re.IGNORECASE)
BASE_OK = re.compile(r"^[a-zà-ÿ]+(?:[-'][a-zà-ÿ]+)*$", re.IGNORECASE)

def real_gloss(senses):
    for s in senses:
        gl = s.get("glosses") or s.get("raw_glosses")
        if not gl:
            continue
        g = re.sub(r"\s+", " ", gl[0]).strip()[:MAX_DEF].strip()
        if not g:
            continue
        if s.get("form_of") or s.get("alt_of") or INFL.match(g):
            continue
        return g
    return None

def main():
    defs = json.loads(DEFS.read_text(encoding="utf-8"))
    bases = set()
    for gloss in defs.values():
        b = form_of_base(gloss)
        if b:
            bases.add(b)
    wanted = {b for b in bases if b not in defs and BASE_OK.match(b)}
    print(f"form-of bases referenced: {len(bases)}; missing & wanted: {len(wanted)}", flush=True)

    print("Streaming nlwiktionary dump (127 MB gz) …", flush=True)
    req = urllib.request.Request(WIKT_GZ, headers={"User-Agent": "wordguesser-build"})
    found = {}
    seen = 0
    with urllib.request.urlopen(req) as resp:
        gz = gzip.GzipFile(fileobj=resp)
        for raw in io.TextIOWrapper(gz, encoding="utf-8"):
            seen += 1
            if seen % 400000 == 0:
                print(f"  … {seen} entries, {len(found)}/{len(wanted)} bases found", flush=True)
            raw = raw.strip()
            if not raw:
                continue
            try:
                d = json.loads(raw)
            except Exception:
                continue
            if d.get("lang_code") != "nl":
                continue
            wl = d.get("word", "").lower()
            if wl not in wanted or wl in found:
                continue
            g = real_gloss(d.get("senses", []))
            if g:
                found[wl] = g

    print(f"base definitions found: {len(found)} / {len(wanted)}", flush=True)
    defs.update(found)
    with open(DEFS, "w", encoding="utf-8") as f:
        json.dump(defs, f, ensure_ascii=False, sort_keys=True)
    print(f"wrote {DEFS.name}: {len(defs)} entries, {DEFS.stat().st_size} bytes", flush=True)

if __name__ == "__main__":
    main()
