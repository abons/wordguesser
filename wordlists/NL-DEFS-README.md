# Dutch definitions (`nl-defs.json`)

`nl-defs.json` maps each Dutch game word to a short definition. Word Guesser uses it to show
a definition directly (via the "?" button) without any online AI service.

## Attribution (required — CC BY-SA)

- **Definitions source:** the **Dutch Wiktionary** ([nl.wiktionary.org](https://nl.wiktionary.org/),
  "WikiWoordenboek"), via the machine-readable [kaikki.org](https://kaikki.org/) wiktextract
  dump (`nlwiktionary/raw-wiktextract-data.jsonl.gz`).
- **License:** **[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)** (Wiktionary
  content is dual CC BY-SA 3.0 / GFDL). This data file (`nl-defs.json`) is a derivative and is
  therefore itself distributed under **CC BY-SA 3.0**. Share-alike applies to the *definition
  data*; it does not affect the app's source-code license (MIT).
- **Word membership** additionally uses the OpenTaal approved list — see
  [NL-README.md](NL-README.md).

## Modifications made

Built by [`build-nl-defs.py`](build-nl-defs.py) from the sources above:

- Kept only Dutch (`lang_code == "nl"`) entries.
- Kept a word only if it is valid for the game (no uppercase, diacritic-folded length 4–8,
  letters only) **and** present in the OpenTaal approved list **and** has a real definition.
- For each word, took the **first real sense's gloss**; pure inflection pointers
  (e.g. "vervoeging van …", "meervoud van …") are not treated as definitions.
- Collapsed whitespace and truncated each definition to 180 characters.

No definitions were rewritten; they are excerpts of the original Wiktionary glosses.
Regenerate with `python build-nl-defs.py`.
