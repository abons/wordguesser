# Dutch word list (`nl.txt`)

This file is a **filtered derivative** of the OpenTaal word list, hosted here so the Word
Guesser app can download it from a stable location.

## Attribution

- **Source:** OpenTaal — [opentaal-wordlist](https://github.com/OpenTaal/opentaal-wordlist),
  file `elements/basiswoorden-gekeurd.txt` (approved base words).
- **Author / copyright:** © Stichting OpenTaal.
- **License:** dual-licensed **[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)**
  and the 3-clause **BSD** license (see the upstream repository for the full text).

## Modifications made to the original

The upstream file was **not** copied verbatim. It was filtered to produce a compact list
suitable for the game, using [`build-nl.sh`](build-nl.sh) in this folder:

- Removed hunspell flags (anything after `/`) and whitespace.
- Removed all entries containing an uppercase letter (proper nouns, acronyms, Roman numerals).
- Kept only words whose **diacritic-folded** length is 4–8 characters.
- Removed entries with any non-letter (digits, hyphens, apostrophes).
- De-duplicated and sorted.
- The **original lowercase spelling (with accents)** is preserved for each kept word.

No words were added; the original spellings of the retained words are unchanged.
Regenerate at any time with `bash build-nl.sh`.

## `nl-v2.txt` — the pool without words a game should not require

`nl-v2.txt` is `nl.txt` with **112 words removed** and nothing added or changed: crude, sexual and
abusive words that a game which *chooses* words for the player (a grid word you must find, a whole
letter wheel, a crossword answer) should never hand out. It is a separate file because published
lists are immutable (see [SOURCES.md](SOURCES.md)): apps that already shipped keep reading `nl.txt`,
and an app switches to `nl-v2.txt` at its own release.

- Input: `nl.txt`, 30,814 words, SHA-256 `f7ea56a2…1f9980`.
- Output: `nl-v2.txt`, 30,702 words, SHA-256 `eaaaf153…028413`. Same order, same line endings.
- `nl-accept.txt` is **not** filtered: every removed word is still accepted when a player types it.
  What the filter removes is only the game choosing it.
- The editorial list is maintained in the private Word Swipe source (decided 2026-10-04) and is
  not published here. To check a copy: `nl.txt` minus that list must reproduce the hash above.
