#!/usr/bin/env python3
"""Build the self-hosted Dutch word+definition data for Word Guesser.

Sources
  - Definitions: Dutch Wiktionary (nl.wiktionary.org) via kaikki.org's wiktextract
    dump (raw-wiktextract-data.jsonl.gz). Definitions are CC BY-SA 3.0 — see
    NL-DEFS-README.md for attribution (required).
  - Quality gate: OpenTaal wordlist.txt (approved Dutch words).

Two-tier policy:
  - nl-accept.txt : ALL valid OpenTaal-approved words (4-8) — the set of words accepted
    as guesses and recognised with "?" (includes conjugations like "lacht").
  - nl.txt        : the ANSWER pool = accepted words that also have a REAL Dutch definition
    (pure inflection pointers like "vervoeging van ..." do not count). Keeps daily/target
    words to proper, definable base words.
  - nl-defs.json  : { word: gloss } for every word that has ANY Wiktionary gloss — a real
    definition when available, otherwise the inflection pointer ("vervoeging van lachen").
    The app shows this directly on "?"; words with no gloss fall back to Gemini.

Sources: definitions from Dutch Wiktionary via kaikki.org (CC BY-SA 3.0, see
NL-DEFS-README.md); word membership from OpenTaal wordlist.txt (see NL-README.md).
"""
import gzip, io, json, re, sys, unicodedata, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
WIKT_GZ = "https://kaikki.org/nlwiktionary/raw-wiktextract-data.jsonl.gz"
OPENTAAL = "https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/wordlist.txt"
OUT_WORDS = HERE / "nl.txt"
OUT_ACCEPT = HERE / "nl-accept.txt"
OUT_DEFS = HERE / "nl-defs.json"
MAX_DEF = 180

def fold(w: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", w)
                   if unicodedata.category(c) != "Mn")

LETTERS = re.compile(r"[A-Za-z]+$")

# Grammatical words that make up formulaic "form-of" glosses ("… van <base>").
# Mirrors MainActivity.FORM_OF_WORDS. A gloss is a form-of pointer only when every
# word before the final " van <base>" is in this set; the app then resolves it to the
# base word's real definition. We therefore also keep base defs even for bases that
# fall outside the 4-8 length filter (used ONLY for resolution, never as guess/answer).
FORM_OF_WORDS = set("""
van de het eerste tweede derde persoon enkelvoud meervoud tegenwoordige verleden tijd
voltooid onvoltooid deelwoord verbogen onverbogen vorm stellende vergrotende overtreffende
trap partitief genitief datief nominatief accusatief aanvoegende gebiedende wijs vervoeging
verbuiging beklemtoonde onbeklemtoonde nadrukkelijke onnadrukkelijke onzijdig mannelijk
vrouwelijk mannelijke vrouwelijke onpersoonlijke persoonlijke verkleinvorm verkleinwoord
verkorting verouderde oude dialectvorm dialectische schrijfwijze spelling spellingvariant
spellingsvariant zelfstandig naamwoord bijvoeglijk werkwoord bijwoord telwoord
""".split())
BASE_OK = re.compile(r"^[a-zà-ÿ]+(?:[-'][a-zà-ÿ]+)*$", re.IGNORECASE)

def form_of_base(gloss: str):
    t = gloss.strip().rstrip(".")
    i = t.lower().rfind(" van ")
    if i < 0:
        return None
    base = t[i + 5:].strip().lower()
    if not base or " " in base or not BASE_OK.match(base):
        return None
    words = [w for w in t[:i].lower().split() if w]
    if not words or any(w not in FORM_OF_WORDS for w in words):
        return None
    return base

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

def best_gloss(senses):
    """Return (text, is_real): a real definition if any sense has one, else the first
    inflection-pointer gloss ("vervoeging van ..."), else (None, False)."""
    fallback = None
    for s in senses:
        gl = s.get("glosses") or s.get("raw_glosses")
        if not gl:
            continue
        g = re.sub(r"\s+", " ", gl[0]).strip()[:MAX_DEF].strip()
        if not g:
            continue
        is_infl = bool(s.get("form_of") or s.get("alt_of") or INFL.match(g))
        if is_infl:
            if fallback is None:
                fallback = g
            continue
        return g, True
    return (fallback, False)

def load_universe() -> set:
    """Valid game words from OpenTaal, lowercased. is_valid is applied to the ORIGINAL
    spelling so entries with any uppercase (proper nouns, acronyms) are rejected."""
    print("Downloading OpenTaal wordlist.txt …", flush=True)
    req = urllib.request.Request(OPENTAAL, headers={"User-Agent": "wordguesser-build"})
    uni = set()
    with urllib.request.urlopen(req) as r:
        for line in io.TextIOWrapper(r, encoding="utf-8"):
            w = line.strip()
            if w and is_valid(w):
                uni.add(w.lower())
    print(f"  OpenTaal valid words: {len(uni)}", flush=True)
    return uni

def main():
    universe = load_universe()  # already valid + lowercased
    accept = sorted(universe)   # accept list: guesses + "?" recognition
    print(f"Accept list (valid 4-8): {len(accept)} words", flush=True)

    print("Streaming nlwiktionary dump (127 MB gz) …", flush=True)
    req = urllib.request.Request(WIKT_GZ, headers={"User-Agent": "wordguesser-build"})
    accept_set = set(accept)
    defs = {}          # word -> gloss (real or inflection pointer)
    real_words = set()  # words whose gloss is a real definition (the answer pool)
    real_all = {}       # ANY nl word -> real gloss (for resolving out-of-range bases)
    seen = 0
    with urllib.request.urlopen(req) as resp:
        gz = gzip.GzipFile(fileobj=resp)
        for raw in io.TextIOWrapper(gz, encoding="utf-8"):
            seen += 1
            if seen % 200000 == 0:
                print(f"  … {seen} entries, {len(defs)} glosses", flush=True)
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
            if not wl:
                continue
            g, is_real = best_gloss(d.get("senses", []))
            # Keep the first REAL gloss for any word, so form-of bases that fall outside
            # the 4-8 filter (long infinitives, short nouns) can still be resolved.
            if is_real and g and wl not in real_all:
                real_all[wl] = g
            if wl not in accept_set:
                continue
            if g and (wl not in real_words):  # first real def wins; else keep first pointer
                if is_real:
                    defs[wl] = g
                    real_words.add(wl)
                elif wl not in defs:
                    defs[wl] = g
    answers = sorted(real_words)

    # Add real definitions for the base words that form-of pointers reference but that
    # aren't already in defs (e.g. "verkennen" behind "… verleden tijd van verkennen").
    # These are resolution targets only — NOT added to accept/answers.
    bases = {b for gloss in defs.values() if (b := form_of_base(gloss)) and b not in defs}
    added = {b: real_all[b] for b in bases if b in real_all}
    defs.update(added)
    print(f"form-of base defs added (out-of-range resolution targets): {len(added)} "
          f"of {len(bases)} referenced", flush=True)
    OUT_ACCEPT.write_text("\n".join(accept) + "\n", encoding="utf-8")
    OUT_WORDS.write_text("\n".join(answers) + "\n", encoding="utf-8")
    with open(OUT_DEFS, "w", encoding="utf-8") as f:
        json.dump(defs, f, ensure_ascii=False, sort_keys=True)
    print(f"Done. answers(real def)={len(answers)}  accept={len(accept)}  "
          f"defs(incl. pointers)={len(defs)}", flush=True)
    for p in (OUT_ACCEPT, OUT_WORDS, OUT_DEFS):
        print(f"  {p.name}: {p.stat().st_size} bytes", flush=True)

if __name__ == "__main__":
    main()
