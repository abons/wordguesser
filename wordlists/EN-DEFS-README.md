# English definitions (`en-defs-v1.json`) and answer pool (`en-answers-v1.txt`)

`en-defs-v1.json` maps each English game word to a short definition; `en-answers-v1.txt` is the
list of exactly those words, one per line. Word Cross builds its crossword clues from the pair —
the clue *is* the definition with the answer masked out of it.

Two files, because the answer pool **is** the definable subset: `en-v1.txt` holds 146,606 words and
Open English WordNet defines 29,662 of them (20.2%). Shipping the big list as the pool would make an
app download 1.1 MB to use a fifth of it.

## Attribution (required — CC BY 4.0)

- **Definitions source:** **[Open English WordNet](https://en-word.net/) 2025**
  (`english-wordnet-2025.xml.gz`, WN-LMF 1.3 XML), the community fork of Princeton WordNet
  maintained at [globalwordnet/english-wordnet](https://github.com/globalwordnet/english-wordnet).
- **License:** **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**, and the dump
  declares it itself, on the `<Lexicon>` element:
  `license="https://creativecommons.org/licenses/by/4.0" version="2025"`. That is why this source
  and not Princeton WordNet 3.1, whose licence is permissive but stated away from the data.
  The licence text is in [`licenses/en-defs-v1.txt`](licenses/en-defs-v1.txt).
  `en-defs-v1.json` is a derivative and is distributed under **CC BY 4.0**; that covers the
  *definition data* and not the app's source-code licence.
- **Word membership** comes from [`en-v1.txt`](en-v1.txt) — dwyl/english-words, `Unlicense`, see
  [SOURCES.md](SOURCES.md).

## Modifications made

Built by [`build-en-defs.js`](build-en-defs.js) (`node build-en-defs.js`) from the sources above:

- Kept a word only if it is in `en-v1.txt` (so: lowercase a–z, length 4–8, no multiword entries and
  none of WordNet's `.22`-style lemmas).
- For each word, took the **first sense** of its entry — the order WordNet itself ranks them in —
  and that sense's synset `<Definition>`.
- A word that is several parts of speech gets the clue of the **first of n, v, a/s, r** that has
  one. Noun first is the dictionary convention and reads best as a clue. ⚠️ That is a choice and
  not a measurement: it changes *which* definition a word gets, never how many words get one.
- Collapsed whitespace and truncated each definition to 180 characters — the same ceiling
  `nl-defs.json` uses, so both languages read alike.

No definitions were rewritten; they are excerpts of the original glosses. Every word in the file has
a real definition, so there is no counterpart to the Dutch "added original definitions" section.

## What this pipeline does *not* need

WordNet is a cleaner source than Wiktionary, and three stages of the Dutch pipeline fall away:

- **No form-of stage.** WordNet holds no inflections, so there is nothing that looks like
  *"vervoeging van lachen"* to detect and resolve. Measured residue: zero.
- **No accept list.** `nl-accept.txt` is Word Guesser's guess-recognition list and Word Guesser is
  Dutch; nothing here needs one.
- **No example-stripping.** Princeton-style glosses carry their example inside the text
  (`definition; "he ran home"`); OEWN keeps them in separate `<Example>` elements. The builder
  counts glosses that look like they carry one anyway, and reports **0** — so the day that changes,
  it says so instead of shipping example sentences as clues.

Domain labels such as `(botany)` and `(psychiatry)` are deliberately kept. They are part of the clue.

## The numbers, measured 2026-08-16

| | |
| --- | --- |
| pool `en-v1.txt` | 146,606 words |
| synsets with a definition | 107,519 |
| **words defined → `en-defs-v1.json`** | **29,662** (20.2% of the pool), 2,028,535 B |
| `en-answers-v1.txt` | 224,686 B |
| surviving Word Cross's clue rules | **29,262** (98.7%) |

The 400 that do not survive are the ones masking hollows out — `actively :: in an active manner`,
`alluvial :: of or relating to alluvium` — which is the content-word floor doing its job. For scale:
Dutch gives 30,008 clues and 29,406 candidates, so the two languages land within half a percent of
each other.

⚠️ **The earlier estimate said 28,507** (`wordpuzzle/docs/besluiten/meertaligheid-…`, 2026-07-29,
where the file size 1.93 MB was predicted exactly). The build gives 1,155 more. Not chased down;
the likely cause is a different sense- or part-of-speech rule in the estimate, and the direction is
the harmless one.

⚠️ **207 definitions are cut mid-word at 180 characters** (201 of them inside a word). That is
inherited behaviour, not new: `nl-defs.json` has 541 of them out of 68,652. Fixing it means cutting
on the last word boundary, which changes every affected clue — so it belongs to a future
`en-defs-v2.json`, not to an edit of this file.

## Rebuilding

`node build-en-defs.js`. It uses `english-wordnet-2025.xml.gz` beside it when present (gitignored,
11,363,503 B) and downloads it otherwise, and it **refuses to overwrite** an existing output: a
published file is immutable, so a change means `-v2` beside it. See
[SOURCES.md](SOURCES.md) → *Published files are immutable*.

⚠️ It is JavaScript while [`build-nl-defs.py`](build-nl-defs.py) is Python, because the machine that
builds these has Node and no Python. A build script nobody can run is not a build script.
