#!/usr/bin/env bash
#
# Builds nl-freq-v1.txt: the words of nl.txt, ordered most-common-first.
#
# Why this file exists
# --------------------
# nl.txt is an alphabetical pool of ~30.8k Dutch words that all have a real definition. It says
# nothing about how *well known* a word is, so a game picking from it uniformly picks "tenakel",
# "asleger" and "erewijn" as often as "gezicht". This file adds the missing axis: a familiarity
# ranking, so an app can prefer everyday words (better puzzle seeds) and can also treat rank as a
# difficulty knob.
#
# It is a re-ordering of nl.txt and nothing else — no words are added or removed. Pool words the
# frequency source has never seen are simply absent, which is itself the signal "rarer than
# anything listed here"; the consuming app treats absent as the rarest bucket.
#
# See NL-FREQ-README.md for attribution and the licence (CC BY-SA 4.0 — inherited from the
# frequency source, so this output file carries it too).
#
# Usage: bash build-nl-freq.sh
#
set -euo pipefail
cd "$(dirname "$0")"

OUT="nl-freq-v1.txt"
POOL="nl.txt"

# Pinned to the last commit that touched the upstream file (2019-02-14) rather than a moving
# branch, so re-running this script reproduces the same ordering rather than silently drifting.
UPSTREAM_SHA="bd9e23103f0a7f89b4c604ecf8638e6f62ee0211"
FREQ_URL="https://raw.githubusercontent.com/hermitdave/FrequencyWords/${UPSTREAM_SHA}/content/2018/nl/nl_full.txt"

# Published files are immutable (see SOURCES.md) — every installed app downloads this exact name,
# so a rebuild must never rewrite it in place. Bump to -v2 instead.
if [ -e "$OUT" ]; then
  echo "$OUT already exists — published files are immutable; write nl-freq-v2.txt instead." >&2
  exit 1
fi
[ -f "$POOL" ] || { echo "$POOL not found (run from wordlists/)" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "downloading frequency source (~15 MB) ..."
curl -fsSL "$FREQ_URL" -o "$tmp/nl_full.txt"

# Two passes over awk's two inputs:
#   pass 1 (the frequency list, "word count" per line, already sorted most-common-first):
#           remember each word's line number as its rank. First occurrence wins.
#   pass 2 (nl.txt, one word per line): emit "rank<TAB>word" for the words we have a rank for.
# Then sort numerically by rank and drop the rank column. sub(/\r$/, "") because a Windows
# checkout of this repo has CRLF line endings and awk would otherwise keep the CR in $1.
#
# Deliberately NO tolower() on the pool word: nl.txt is already all-lowercase (build-nl.sh drops
# every entry containing an uppercase letter), and calling tolower() here silently *corrupted*
# accented words. With LANG unset, gawk folds byte-by-byte in the C locale, so the 0xC3 lead byte
# of a UTF-8 "è" maps to 0xE3 and "ampère" became an unmatchable "amp?re" — quietly dropping all
# 303 accented pool words from the output.
awk '
  { sub(/\r$/, "") }
  NR == FNR { if (!($1 in rank)) rank[$1] = FNR; next }
  { if ($1 != "" && ($1 in rank)) print rank[$1] "\t" $1 }
' "$tmp/nl_full.txt" "$POOL" | sort -n -k1,1 | cut -f2 > "$OUT"

pool_n=$(grep -c . "$POOL")
out_n=$(grep -c . "$OUT")
echo "$OUT: $out_n of $pool_n pool words ranked ($(( out_n * 100 / pool_n ))%); the rest are rarer than the source knows."
