#!/usr/bin/env bash
# Regenerate the self-hosted Dutch word list (wordlists/nl.txt) from OpenTaal.
#
# This mirrors, exactly, the filter the app applies in WordLists.clean():
#   - drop anything after a '/' (hunspell flags), trim
#   - reject entries containing ANY uppercase letter (proper nouns / acronyms)
#   - fold diacritics (Unicode NFD + strip combining marks, like Java's Normalizer)
#     and require the folded length to be 4..8
#   - require every folded char to be a plain A-Z letter (no digits / hyphens / apostrophes)
#   - keep the ORIGINAL lowercase spelling (accents preserved) so the app's own clean()
#     accepts it and can show accented forms on a match.
#
# Output is a small (~150 KB) list the app downloads instead of the 2.5 MB upstream file.
# Attribution + license + modifications are in NL-README.md (required by CC BY 3.0).
set -euo pipefail

SRC="https://raw.githubusercontent.com/OpenTaal/opentaal-wordlist/master/elements/basiswoorden-gekeurd.txt"
OUT="$(dirname "$0")/nl.txt"

echo "Downloading OpenTaal basiswoorden-gekeurd…"
curl -fsSL "$SRC" | perl -CSD -MUnicode::Normalize -ne '
  chomp;
  my $w = $_;
  my $s = index($w, "/");
  $w = substr($w, 0, $s) if $s >= 0;
  $w =~ s/^\s+|\s+$//g;
  next if $w eq "";
  next if $w =~ /\p{Lu}/;                 # any uppercase -> reject
  my $f = NFD($w); $f =~ s/\p{Mn}//g;     # fold diacritics
  my $len = length($f);
  next if $len < 4 || $len > 8;
  next unless $f =~ /^[A-Za-z]+$/;        # letters only (no digits/hyphens)
  print "$w\n";
' | LC_ALL=C sort -u > "$OUT"

echo "Wrote $OUT — $(wc -l < "$OUT") words, $(du -h "$OUT" | cut -f1)"
