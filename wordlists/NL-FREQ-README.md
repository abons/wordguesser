# Dutch familiarity ranking (`nl-freq-v1.txt`)

A **re-ordering of [`nl.txt`](nl.txt)**: the same Dutch words, sorted **most-common-first** instead
of alphabetically. Line 1 is the most familiar word, line *n* the least. No words are added and none
are invented — every line is a word that is already in `nl.txt`.

It exists because `nl.txt` carries no notion of how *well known* a word is. A game picking from it
uniformly picks `tenakel`, `asleger` and `erewijn` as readily as `gezicht`, which makes a puzzle feel
broken rather than hard. This file supplies the missing axis, so an app can prefer everyday words for
puzzle seeds and can also use rank as a difficulty knob.

## Attribution

- **Frequency source:** [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords),
  file `content/2018/nl/nl_full.txt` — word counts derived from the **OpenSubtitles 2018** corpus
  (1,107,145 Dutch word forms). Pinned at commit
  [`bd9e231`](https://github.com/hermitdave/FrequencyWords/commit/bd9e23103f0a7f89b4c604ecf8638e6f62ee0211)
  (2019-02-14), the last commit that touched that file.
- **Author / copyright:** Hermit Dave and contributors.
- **Licence:** the repository's word-list **content** is
  **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)** (its *code* is MIT, which is
  not what is used here).
- **Word set:** the words themselves come from `nl.txt` — OpenTaal, `CC-BY-3.0 OR BSD-3-Clause`,
  see [NL-README.md](NL-README.md).

### This file is CC BY-SA 4.0

The ordering is taken from a ShareAlike-licensed database, so this output file inherits
**CC BY-SA 4.0** and is published under it, with attribution as above. That is a property of *this
data file*, which is served over HTTP and downloaded at runtime — it is not bundled into, compiled
into, or linked with any app binary, so it does not affect the apps' own licensing (same reasoning as
the copyleft lists in [SOURCES.md](SOURCES.md)).

## How it was built

[`build-nl-freq.sh`](build-nl-freq.sh) (`bash build-nl-freq.sh`), which:

- downloads the pinned upstream frequency list (`word count` per line, already ordered
  most-common-first);
- records each upstream word's line number as its rank (first occurrence wins);
- emits every `nl.txt` word that has a rank, ordered by it.

**25,037 of the 30,814 pool words (81%) are ranked.** The remaining 5,777 do not appear anywhere in
a 1.1-million-word corpus, which is itself the signal *"rarer than anything listed here"* — they are
simply absent, and a consumer should treat absence as the rarest bucket rather than as missing data.

Two things the script does deliberately, both of which were bugs first:

- **It does not call `tolower()` on the pool word.** `nl.txt` is already all-lowercase, and with
  `LANG` unset gawk folds byte-by-byte in the C locale: the `0xC3` lead byte of a UTF-8 `è` maps to
  `0xE3`, so `ampère` became an unmatchable `amp?re` and all 303 accented pool words vanished from
  the output.
- **It refuses to overwrite an existing `nl-freq-v1.txt`**, because published files are immutable
  (see [SOURCES.md](SOURCES.md)) — every installed copy of an app downloads this exact name. A
  changed ranking is a new `nl-freq-v2.txt` beside it, never an edit in place.
