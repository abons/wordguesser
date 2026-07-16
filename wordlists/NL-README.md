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
