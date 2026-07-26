#!/usr/bin/env python3
"""Regenerate the self-hosted mirrors of every downloadable word list.

Why this exists
---------------
Word Guesser used to download 16 of its 17 languages straight from third-party GitHub
raw URLs. One dead repo (or one renamed branch) = one permanently broken language, with
no way to fix it without shipping a new APK. So every list is mirrored here, on our own
GitHub Pages host, next to the Dutch list that was already self-hosted.

What it produces (per language `X`, at list version `N`)
--------------------------------------------------------
  X-vN.txt              the filtered word list the app downloads
  licenses/X-vN.txt     the upstream licence text at that version, copied verbatim
  SOURCES.md            attribution table (source, author, licence, upstream URL, counts)

Why the `-vN` in the filename
-----------------------------
This directory is *live shared infrastructure*: it is served straight off GitHub Pages to
every installed copy of the app (and, for the Dutch files, to two sibling apps too). An
in-place edit would therefore change the answer pool under players who already have the app
— including mid-day, which would put scores for two different answers in one daily
leaderboard. So a list is **never edited in place**. Re-mirroring an upstream that has moved
on means bumping `version` below, which writes a *new* file; the old one stays up forever and
each app switches over at its own release, by pointing at the new name.

Grandfather clause: the Dutch files predate this rule and keep their unversioned names
(`nl.txt`, `nl-accept.txt`, `nl-defs.json`) because three shipped apps hard-code them. Treat
those as version 1; the next Dutch pool change becomes `nl-v2.txt` alongside them.

The filter replicates `WordLists.clean()` in the app *exactly*, so the app's own
`clean()` is a no-op on the mirror (it still runs — the mirror is just pre-filtered):

  - drop anything after a '/' (hunspell flags), trim
  - reject entries containing ANY uppercase letter (proper nouns / acronyms / numerals)
  - fold diacritics (NFD + strip combining marks) when the language folds
  - require the folded length to be within the language's [minLen, maxLen]
  - require every folded char to be A-Z or one of the language's `extra` letters
  - keep the ORIGINAL lowercase spelling (accents preserved), so the app can show the
    accented form once a word matches

Output is sorted + de-duplicated (LC_ALL=C order, i.e. plain codepoint sort).

The Dutch list is NOT built here — it has its own two-tier pipeline (answers + accept
list + definitions) in build-nl.sh / build-nl-defs.py. It is listed in SOURCES.md.

Usage:  python build-lists.py [code ...]      (no args = all)
"""

import sys
import unicodedata
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LICENSE_DIR = HERE / "licenses"

WOOORM_RAW = "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries"
WOOORM_TREE = "https://github.com/wooorm/dictionaries/tree/main/dictionaries"


def woo(code, label, min_len, max_len, extra, spdx, author, version=1):
    """A wooorm/dictionaries language (hunspell `word/FLAGS`, all fold to A-Z + extra)."""
    return dict(
        code=code, label=label, url=f"{WOOORM_RAW}/{code}/index.dic", version=version,
        min_len=min_len, max_len=max_len, extra=extra, fold=True,
        source=f"wooorm/dictionaries · {code}", author=author, spdx=spdx,
        homepage=f"{WOOORM_TREE}/{code}", license_url=f"{WOOORM_RAW}/{code}/license",
    )


# Mirrors the LANGUAGES table in app/src/main/java/com/hrbons/wordguesser/WordLists.kt.
# Keep the two in sync: same url source, min/max length, extra letters, fold flag — and the
# same `version`, which is part of the filename the app asks for. Bump `version` (never edit a
# published file) when re-mirroring a moved upstream; see the module docstring.
LANGS = [
    dict(
        code="en", label="English (large)", version=1,
        url="https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
        min_len=4, max_len=8, extra="", fold=False,
        source="dwyl/english-words", author="dwyl and contributors",
        spdx="Unlicense", homepage="https://github.com/dwyl/english-words",
        license_url="https://raw.githubusercontent.com/dwyl/english-words/master/LICENSE.md",
    ),
    dict(
        code="fr", label="Français", version=1,
        url="https://raw.githubusercontent.com/lorenbrichter/Words/master/Words/fr.txt",
        min_len=5, max_len=8, extra="", fold=True,
        source="lorenbrichter/Words", author="Loren Brichter",
        spdx="CC0-1.0", homepage="https://github.com/lorenbrichter/Words",
        license_url="https://raw.githubusercontent.com/lorenbrichter/Words/master/LICENSE",
    ),
    dict(
        code="de", label="Deutsch", version=1,
        url="https://raw.githubusercontent.com/enz/german-wordlist/master/words",
        min_len=4, max_len=8, extra="ß", fold=True,
        source="enz/german-wordlist", author="Matthias Enzmann and contributors",
        spdx="CC0-1.0", homepage="https://github.com/enz/german-wordlist",
        license_url="https://raw.githubusercontent.com/enz/german-wordlist/master/COPYING",
    ),
    dict(
        code="es", label="Español", version=1,
        url="https://raw.githubusercontent.com/lorenbrichter/Words/master/Words/es.txt",
        min_len=4, max_len=8, extra="", fold=True,
        source="lorenbrichter/Words", author="Loren Brichter",
        spdx="CC0-1.0", homepage="https://github.com/lorenbrichter/Words",
        license_url="https://raw.githubusercontent.com/lorenbrichter/Words/master/LICENSE",
    ),
    # SPDX ids below are the ones wooorm records in each dictionary's package.json.
    woo("it", "Italiano", 5, 8, "", "GPL-3.0", "Italian Writing Aids / LibreItalia"),
    woo("pt", "Português", 4, 8, "", "LGPL-3.0 OR MPL-2.0", "Raimundo Moura"),
    woo("ca", "Català", 4, 8, "", "GPL-2.0 OR LGPL-2.1", "Softcatalà"),
    woo("ro", "Română", 4, 8, "", "GPL-2.0 OR LGPL-2.1 OR MPL-1.1", "Rospell Team"),
    woo("sv", "Svenska", 4, 8, "", "LGPL-3.0", "Göran Andersson"),
    woo("cs", "Čeština", 4, 8, "", "GPL-2.0", "Czech spell-check project"),
    woo("sk", "Slovenčina", 4, 8, "", "GPL-2.0 OR LGPL-2.1 OR MPL-1.1", "Zdenko Podobný"),
    woo("da", "Dansk", 4, 8, "ÆØ", "GPL-2.0 OR LGPL-2.1 OR MPL-1.1", "Stavekontrolden"),
    woo("nb", "Norsk", 4, 8, "ÆØ", "GPL-2.0", "Norwegian Spell-checker project"),
    woo("pl", "Polski", 4, 8, "Ł", "GPL-3.0 OR LGPL-3.0 OR MPL-2.0",
        "Polish Native Lang Project"),
    woo("hr", "Hrvatski", 5, 8, "Đ", "LGPL-2.1 OR SISSL", "Denis Lackovic"),
]

# Self-hosted already, via its own pipeline — listed in SOURCES.md, never rebuilt here.
NL_ROW = dict(
    code="nl", label="Nederlands", source="OpenTaal (approved base words)",
    author="Stichting OpenTaal", spdx="CC-BY-3.0 OR BSD-3-Clause",
    homepage="https://github.com/OpenTaal/opentaal-wordlist",
    license_url="https://creativecommons.org/licenses/by/3.0/",
)


def upper_char(c):
    """Kotlin's Char.uppercaseChar(): leaves 'ß' alone instead of expanding it to 'SS'."""
    u = c.upper()
    return u if len(u) == 1 else c


def strip_diacritics(s):
    """NFD + drop combining marks — ä→a, é→e; æ/ø/ł/đ/ß have no marks and survive."""
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def clean(raw, extra, fold, min_len, max_len):
    """Port of WordLists.clean(), but returning the original lowercase form."""
    w = raw
    slash = w.find("/")
    if slash >= 0:
        w = w[:slash]
    w = w.strip()
    if not w:
        return None
    if any(c.isupper() for c in w):
        return None
    folded = strip_diacritics(w) if fold else w
    if not (min_len <= len(folded) <= max_len):
        return None
    for c in folded:
        u = upper_char(c)
        if not ("A" <= u <= "Z") and u not in extra:
            return None
    return w


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "WordGuesser-mirror"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def stem(lang):
    """The published basename: `<code>-v<version>`, e.g. `pl-v1`."""
    return f"{lang['code']}-v{lang['version']}"


def build(lang):
    out = HERE / f"{stem(lang)}.txt"
    if out.exists():
        # Published files are immutable — bump `version` instead of overwriting one.
        print(f"[{lang['code']}] {out.name} already exists, skipping "
              f"(bump version= to re-mirror)")
        body = out.read_text(encoding="utf-8")
        n = sum(1 for line in body.splitlines() if line)
        return dict(lang, count=n, kb=len(body.encode("utf-8")) / 1024)

    print(f"[{lang['code']}] downloading {lang['url']}")
    raw = fetch(lang["url"]).decode("utf-8", errors="replace")
    words = set()
    total = 0
    for line in raw.splitlines():
        total += 1
        w = clean(line, lang["extra"], lang["fold"], lang["min_len"], lang["max_len"])
        if w:
            words.add(w)
    # Plain codepoint sort, matching `LC_ALL=C sort -u` used by build-nl.sh.
    body = "\n".join(sorted(words)) + "\n"
    out.write_text(body, encoding="utf-8", newline="\n")

    LICENSE_DIR.mkdir(exist_ok=True)
    (LICENSE_DIR / f"{stem(lang)}.txt").write_bytes(fetch(lang["license_url"]))

    kb = len(body.encode("utf-8")) / 1024
    print(f"[{lang['code']}] {len(words):,} words of {total:,} lines → {out.name} ({kb:.0f} KB)")
    return dict(lang, count=len(words), kb=kb)


def write_sources(rows):
    lines = [
        "# Word-list sources & licences",
        "",
        "Every downloadable word list Word Guesser uses is **mirrored here**, on our own",
        "GitHub Pages host, instead of being fetched from a third-party GitHub raw URL at",
        "runtime. One upstream repo going away used to mean one permanently broken language.",
        "",
        "Each `<code>-v<n>.txt` is a **filtered derivative** of the upstream list, not a",
        "verbatim copy — see *Modifications* below. Each one stays under its upstream licence;",
        "that licence text is copied verbatim into [`licenses/`](licenses/). No words added.",
        "",
        "Built by [`build-lists.py`](build-lists.py) (`python build-lists.py [code …]`).",
        "",
        "## Published files are immutable",
        "",
        "This directory is served straight off GitHub Pages to every installed copy of the app,",
        "so **a list is never edited in place** — that would change the answer pool under people",
        "who are already playing, and could put scores for two different answers into the same",
        "daily leaderboard. Re-mirroring a moved upstream writes a *new* `-v<n+1>` file; the old",
        "one stays up forever, and each app switches over at its own release by asking for the",
        "new name. `build-lists.py` refuses to overwrite a file that already exists.",
        "",
        "The Dutch files predate this rule and keep their unversioned names (`nl.txt`,",
        "`nl-accept.txt`, `nl-defs.json`) because three shipped apps hard-code them — treat those",
        "as version 1. The next Dutch pool change becomes `nl-v2.txt` beside them.",
        "",
        "## Modifications made to every list",
        "",
        "- Removed hunspell flags (anything after `/`) and surrounding whitespace.",
        "- Removed every entry containing an uppercase letter (proper nouns, acronyms,",
        "  Roman numerals) — the game only wants common words.",
        "- Kept only words whose **diacritic-folded** length is within the language's range.",
        "- Removed entries with any non-letter (digits, hyphens, apostrophes) after folding.",
        "- De-duplicated and sorted (plain codepoint order).",
        "- The **original lowercase spelling, with accents**, is preserved for each kept word.",
        "",
        "## Per-language attribution",
        "",
        "| Lang | File | Words | Upstream source | Author / copyright | Licence | Licence text |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in rows:
        if r["code"] == "nl":
            f = "[nl.txt](nl.txt) *(+ accept list & definitions — see [NL-README.md](NL-README.md))*"
            words = "see NL-README"
            lic = f"[upstream]({r['license_url']})"
        else:
            f = f"[{stem(r)}.txt]({stem(r)}.txt)"
            words = f"{r['count']:,}"
            lic = f"[licenses/{stem(r)}.txt](licenses/{stem(r)}.txt)"
        lines.append(
            f"| {r['label']} | {f} | {words} | [{r['source']}]({r['homepage']}) | "
            f"{r['author']} | `{r['spdx']}` | {lic} |"
        )
    lines += [
        "",
        "The built-in English starter list ships inside the app (`WordBank.kt`) and is not",
        "downloaded, so it has no entry here.",
        "",
        "## A note on the copyleft lists",
        "",
        "The `wooorm/dictionaries` lists are hunspell dictionaries under GPL/LGPL/MPL-family",
        "licences. The filtered `.txt` files here are derivative works and remain under the",
        "same licence as their upstream — that licence text sits beside them in `licenses/`,",
        "and the table above names the origin. They are **data files served over HTTP and",
        "downloaded at runtime**; they are not bundled into, compiled into, or linked with the",
        "app binary, which stays MIT.",
        "",
    ]
    (HERE / "SOURCES.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote SOURCES.md ({len(rows)} languages)")


def main():
    wanted = sys.argv[1:]
    todo = [l for l in LANGS if not wanted or l["code"] in wanted]
    if wanted and not todo:
        sys.exit(f"unknown language code(s): {' '.join(wanted)}")
    rows = [build(l) for l in todo]
    if not wanted:  # only rewrite the full table on a full run
        by_code = {r["code"]: r for r in rows}
        ordered = [by_code["en"], NL_ROW] + [by_code[l["code"]] for l in LANGS
                                             if l["code"] != "en"]
        write_sources(ordered)
    total = sum(r["kb"] for r in rows)
    print(f"\ndone — {len(rows)} lists, {total:.0f} KB total")


if __name__ == "__main__":
    main()
