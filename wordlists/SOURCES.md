# Word-list sources & licences

Every downloadable word list Word Guesser uses is **mirrored here**, on our own
GitHub Pages host, instead of being fetched from a third-party GitHub raw URL at
runtime. One upstream repo going away used to mean one permanently broken language.

Each `<code>-v<n>.txt` is a **filtered derivative** of the upstream list, not a
verbatim copy — see *Modifications* below. Each one stays under its upstream licence;
that licence text is copied verbatim into [`licenses/`](licenses/). No words added.

Built by [`build-lists.py`](build-lists.py) (`python build-lists.py [code …]`).

One file here is **not** a word list and none of the above applies to it:
[`nl-freq-v1.txt`](nl-freq-v1.txt) is a familiarity *ranking* of the words already in `nl.txt`
(most-common-first), used by Word Swipe to pick recognisable puzzle seeds. It has its own upstream
and licence — see [NL-FREQ-README.md](NL-FREQ-README.md).

## Published files are immutable

This directory is served straight off GitHub Pages to every installed copy of the app,
so **a list is never edited in place** — that would change the answer pool under people
who are already playing, and could put scores for two different answers into the same
daily leaderboard. Re-mirroring a moved upstream writes a *new* `-v<n+1>` file; the old
one stays up forever, and each app switches over at its own release by asking for the
new name. `build-lists.py` refuses to overwrite a file that already exists.

The Dutch files predate this rule and keep their unversioned names (`nl.txt`,
`nl-accept.txt`, `nl-defs.json`) because three shipped apps hard-code them — treat those
as version 1. The next Dutch pool change becomes `nl-v2.txt` beside them.

## Modifications made to every list

- Removed hunspell flags (anything after `/`) and surrounding whitespace.
- Removed every entry containing an uppercase letter (proper nouns, acronyms,
  Roman numerals) — the game only wants common words.
- Kept only words whose **diacritic-folded** length is within the language's range.
- Removed entries with any non-letter (digits, hyphens, apostrophes) after folding.
- De-duplicated and sorted (plain codepoint order).
- The **original lowercase spelling, with accents**, is preserved for each kept word.

## Per-language attribution

| Lang | File | Words | Upstream source | Author / copyright | Licence | Licence text |
| --- | --- | --- | --- | --- | --- | --- |
| English (large) | [en-v1.txt](en-v1.txt) | 146,606 | [dwyl/english-words](https://github.com/dwyl/english-words) | dwyl and contributors | `Unlicense` | [licenses/en-v1.txt](licenses/en-v1.txt) |
| English *(definitions + their answer pool)* | [en-defs-v1.json](en-defs-v1.json) + [en-answers-v1.txt](en-answers-v1.txt) *(see [EN-DEFS-README.md](EN-DEFS-README.md))* | 29,662 | [Open English WordNet 2025](https://en-word.net/) | Open English WordNet contributors | `CC-BY-4.0` | [licenses/en-defs-v1.txt](licenses/en-defs-v1.txt) |
| Nederlands | [nl.txt](nl.txt) *(+ accept list & definitions — see [NL-README.md](NL-README.md))* | see NL-README | [OpenTaal (approved base words)](https://github.com/OpenTaal/opentaal-wordlist) | Stichting OpenTaal | `CC-BY-3.0 OR BSD-3-Clause` | [upstream](https://creativecommons.org/licenses/by/3.0/) |
| Nederlands *(ranking, not a word list)* | [nl-freq-v1.txt](nl-freq-v1.txt) *(see [NL-FREQ-README.md](NL-FREQ-README.md))* | 25,037 | [hermitdave/FrequencyWords · OpenSubtitles 2018](https://github.com/hermitdave/FrequencyWords) | Hermit Dave and contributors | `CC-BY-SA-4.0` | [upstream](https://creativecommons.org/licenses/by-sa/4.0/) |
| Français | [fr-v1.txt](fr-v1.txt) | 91,071 | [lorenbrichter/Words](https://github.com/lorenbrichter/Words) | Loren Brichter | `CC0-1.0` | [licenses/fr-v1.txt](licenses/fr-v1.txt) |
| Deutsch | [de-v1.txt](de-v1.txt) | 75,977 | [enz/german-wordlist](https://github.com/enz/german-wordlist) | Matthias Enzmann and contributors | `CC0-1.0` | [licenses/de-v1.txt](licenses/de-v1.txt) |
| Español | [es-v1.txt](es-v1.txt) | 163,791 | [lorenbrichter/Words](https://github.com/lorenbrichter/Words) | Loren Brichter | `CC0-1.0` | [licenses/es-v1.txt](licenses/es-v1.txt) |
| Italiano | [it-v1.txt](it-v1.txt) | 24,516 | [wooorm/dictionaries · it](https://github.com/wooorm/dictionaries/tree/main/dictionaries/it) | Italian Writing Aids / LibreItalia | `GPL-3.0` | [licenses/it-v1.txt](licenses/it-v1.txt) |
| Português | [pt-v1.txt](pt-v1.txt) | 82,413 | [wooorm/dictionaries · pt](https://github.com/wooorm/dictionaries/tree/main/dictionaries/pt) | Raimundo Moura | `LGPL-3.0 OR MPL-2.0` | [licenses/pt-v1.txt](licenses/pt-v1.txt) |
| Català | [ca-v1.txt](ca-v1.txt) | 59,809 | [wooorm/dictionaries · ca](https://github.com/wooorm/dictionaries/tree/main/dictionaries/ca) | Softcatalà | `GPL-2.0 OR LGPL-2.1` | [licenses/ca-v1.txt](licenses/ca-v1.txt) |
| Română | [ro-v1.txt](ro-v1.txt) | 60,988 | [wooorm/dictionaries · ro](https://github.com/wooorm/dictionaries/tree/main/dictionaries/ro) | Rospell Team | `GPL-2.0 OR LGPL-2.1 OR MPL-1.1` | [licenses/ro-v1.txt](licenses/ro-v1.txt) |
| Svenska | [sv-v1.txt](sv-v1.txt) | 47,068 | [wooorm/dictionaries · sv](https://github.com/wooorm/dictionaries/tree/main/dictionaries/sv) | Göran Andersson | `LGPL-3.0` | [licenses/sv-v1.txt](licenses/sv-v1.txt) |
| Čeština | [cs-v1.txt](cs-v1.txt) | 56,397 | [wooorm/dictionaries · cs](https://github.com/wooorm/dictionaries/tree/main/dictionaries/cs) | Czech spell-check project | `GPL-2.0` | [licenses/cs-v1.txt](licenses/cs-v1.txt) |
| Slovenčina | [sk-v1.txt](sk-v1.txt) | 79,520 | [wooorm/dictionaries · sk](https://github.com/wooorm/dictionaries/tree/main/dictionaries/sk) | Zdenko Podobný | `GPL-2.0 OR LGPL-2.1 OR MPL-1.1` | [licenses/sk-v1.txt](licenses/sk-v1.txt) |
| Dansk | [da-v1.txt](da-v1.txt) | 34,137 | [wooorm/dictionaries · da](https://github.com/wooorm/dictionaries/tree/main/dictionaries/da) | Stavekontrolden | `GPL-2.0 OR LGPL-2.1 OR MPL-1.1` | [licenses/da-v1.txt](licenses/da-v1.txt) |
| Norsk | [nb-v1.txt](nb-v1.txt) | 56,134 | [wooorm/dictionaries · nb](https://github.com/wooorm/dictionaries/tree/main/dictionaries/nb) | Norwegian Spell-checker project | `GPL-2.0` | [licenses/nb-v1.txt](licenses/nb-v1.txt) |
| Polski | [pl-v1.txt](pl-v1.txt) | 61,185 | [wooorm/dictionaries · pl](https://github.com/wooorm/dictionaries/tree/main/dictionaries/pl) | Polish Native Lang Project | `GPL-3.0 OR LGPL-3.0 OR MPL-2.0` | [licenses/pl-v1.txt](licenses/pl-v1.txt) |
| Hrvatski | [hr-v1.txt](hr-v1.txt) | 23,844 | [wooorm/dictionaries · hr](https://github.com/wooorm/dictionaries/tree/main/dictionaries/hr) | Denis Lackovic | `LGPL-2.1 OR SISSL` | [licenses/hr-v1.txt](licenses/hr-v1.txt) |

The built-in English starter list ships inside the app (`WordBank.kt`) and is not
downloaded, so it has no entry here.

## A note on the copyleft lists

The `wooorm/dictionaries` lists are hunspell dictionaries under GPL/LGPL/MPL-family
licences. The filtered `.txt` files here are derivative works and remain under the
same licence as their upstream — that licence text sits beside them in `licenses/`,
and the table above names the origin. They are **data files served over HTTP and
downloaded at runtime**; they are not bundled into, compiled into, or linked with the
app binary, which stays MIT.
