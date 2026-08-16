#!/usr/bin/env node
/**
 * Build the self-hosted English word+definition data for Word Cross.
 *
 * Sources
 *   - Definitions: Open English WordNet 2025 (en-word.net), WN-LMF 1.3 XML.
 *     CC BY 4.0, and the file declares that itself on its <Lexicon> element —
 *     see EN-DEFS-README.md for the attribution (required).
 *   - Word membership: en-v1.txt, the mirrored dwyl/english-words list already
 *     filtered to lowercase a-z of length 4-8 by build-lists.py.
 *
 * Outputs (both new names, never an edit of a published file):
 *   - en-answers-v1.txt : the ANSWER pool = pool words that WordNet defines.
 *   - en-defs-v1.json   : { word: definition } for exactly those words.
 *
 * Why JavaScript, next to a Python build-nl-defs.py: this machine has Node and
 * no Python, and a build script nobody can run is not a build script. The two
 * pipelines share their shape and their constants (MAX_DEF, "first sense wins"),
 * not their runtime.
 *
 * Four deliberate differences from the Dutch pipeline, all of them WordNet
 * being simpler than Wiktionary:
 *   - No form-of stage. WordNet holds no inflections, so FORM_OF_WORDS,
 *     form_of_base() and the base-resolution pass have nothing to resolve.
 *   - No accept list. That one is Word Guesser's, and Word Guesser is Dutch.
 *   - Examples need no stripping: OEWN carries them in their own <Example>
 *     elements rather than inside the gloss. The script counts what looks like
 *     an embedded one anyway, so the day that stops being true is loud.
 *   - Domain labels like "(botany)" stay in. They are part of the clue.
 *
 * Usage: node build-en-defs.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const readline = require('readline');

const HERE = __dirname;
const OEWN_URL = 'https://en-word.net/static/english-wordnet-2025.xml.gz';
const OEWN_GZ = path.join(HERE, 'english-wordnet-2025.xml.gz');
const POOL = path.join(HERE, 'en-v1.txt');
const OUT_WORDS = path.join(HERE, 'en-answers-v1.txt');
const OUT_DEFS = path.join(HERE, 'en-defs-v1.json');
const MAX_DEF = 180;   // same ceiling as build-nl-defs.py, so both languages read alike

// Which part of speech gives the clue when a word is several. Noun first is the
// dictionary convention and reads best as a crossword clue; this is a choice and
// not a measurement, and it changes the text of a clue, never how many there are.
const POS_RANK = { n: 0, v: 1, a: 2, s: 2, r: 3 };

/** Downloads [url] to [dest], following redirects. Only used when the dump is absent. */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'wordcross-build' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, dest));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`${url}: HTTP ${res.statusCode}`));
      }
      const part = `${dest}.part`;   // one writer, and no half file left behind on a kill
      const out = fs.createWriteStream(part);
      res.pipe(out);
      out.on('finish', () => { out.close(() => { fs.renameSync(part, dest); resolve(); }); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return e in ENTITY ? ENTITY[e] : m;
  });
}

/** Collapsed, trimmed and cut to [MAX_DEF] — the exact treatment nl-defs.json gets. */
function clean(text) {
  return decode(text).replace(/\s+/g, ' ').trim().slice(0, MAX_DEF).trim();
}

function loadPool() {
  const words = fs.readFileSync(POOL, 'utf8').split(/\r?\n/).filter(Boolean);
  const bad = words.filter(w => !/^[a-z]{4,8}$/.test(w));
  if (bad.length) {
    throw new Error(`${path.basename(POOL)} is not the shape this expects: ` +
      `${bad.length} entries outside lowercase a-z 4-8, first "${bad[0]}"`);
  }
  console.log(`pool ${path.basename(POOL)}: ${words.length} words`);
  return new Set(words);
}

async function main() {
  for (const out of [OUT_WORDS, OUT_DEFS]) {
    // Published files are immutable (SOURCES.md): a rebuild writes a new -v<n>.
    if (fs.existsSync(out)) throw new Error(`${path.basename(out)} exists — bump the version instead`);
  }
  const pool = loadPool();

  if (!fs.existsSync(OEWN_GZ)) {
    console.log(`downloading ${OEWN_URL} …`);
    await download(OEWN_URL, OEWN_GZ);
  }
  console.log(`reading ${path.basename(OEWN_GZ)} (${fs.statSync(OEWN_GZ).size} bytes)`);

  // Pass one, streamed: every lemma we care about with its best sense's synset id,
  // and every synset's definition. Entries precede synsets in the file, but nothing
  // here depends on that — the two maps are joined afterwards.
  const senseOf = new Map();   // word -> { rank, synset }
  const defOf = new Map();     // synset id -> definition
  let lemma = null, pos = null, entryDone = false, synset = null;
  let license = null, version = null, inLexicon = false, lexiconDone = false;
  let pending = null;          // a <Definition> that has not closed on this line

  const rl = readline.createInterface({
    input: fs.createReadStream(OEWN_GZ).pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });
  for await (const line of rl) {
    if (pending !== null) {
      const end = line.indexOf('</Definition>');
      if (end < 0) { pending += ' ' + line; continue; }
      const text = clean(pending + ' ' + line.slice(0, end));
      if (synset && text && !defOf.has(synset)) defOf.set(synset, text);
      pending = null;
      continue;
    }
    // ⚠️ The lexicon's own attributes, and only its own: the `<?xml version="1.0"?>`
    // line above it answers a naive /version="…"/ first and reads as the wordnet version.
    if (!lexiconDone) {
      if (inLexicon || line.includes('<Lexicon')) {
        inLexicon = true;
        const m = line.match(/license="([^"]+)"/);
        if (m) license = m[1];
        const v = line.match(/version="([^"]+)"/);
        if (v) version = v[1];
        if (line.includes('>')) { inLexicon = false; lexiconDone = true; }
      }
    }
    if (line.includes('<LexicalEntry ')) { lemma = null; pos = null; entryDone = false; continue; }
    const lem = line.match(/<Lemma writtenForm="([^"]*)" partOfSpeech="([^"]*)"/);
    if (lem) {
      const w = decode(lem[1]);
      lemma = pool.has(w) ? w : null;   // the pool is the filter; multiwords and .22 fall out here
      pos = lem[2];
      continue;
    }
    if (lemma && !entryDone && line.includes('<Sense ')) {
      const syn = line.match(/synset="([^"]+)"/);
      if (syn) {
        entryDone = true;   // first sense of this entry is the one WordNet ranks highest
        const rank = pos in POS_RANK ? POS_RANK[pos] : 9;
        const seen = senseOf.get(lemma);
        if (!seen || rank < seen.rank) senseOf.set(lemma, { rank, synset: syn[1] });
      }
      continue;
    }
    const syn = line.match(/<Synset id="([^"]+)"/);
    if (syn) { synset = syn[1]; continue; }
    const open = line.indexOf('<Definition>');
    if (open >= 0) {
      const rest = line.slice(open + '<Definition>'.length);
      const end = rest.indexOf('</Definition>');
      if (end < 0) { pending = rest; continue; }
      const text = clean(rest.slice(0, end));
      if (synset && text && !defOf.has(synset)) defOf.set(synset, text);
    }
  }
  console.log(`lexicon: license=${license} version=${version}`);
  console.log(`pool words with a sense: ${senseOf.size}   synsets with a definition: ${defOf.size}`);

  const defs = {};
  let missing = 0;
  for (const [word, s] of senseOf) {
    const text = defOf.get(s.synset);
    if (!text) { missing += 1; continue; }
    defs[word] = text;
  }
  if (missing) console.log(`⚠️  ${missing} words pointed at a synset with no definition`);

  const answers = Object.keys(defs).sort();
  // What the Dutch pipeline has to strip and this one should not: a gloss that
  // carries its own example, Princeton-style (definition; "he ran home").
  const embedded = answers.filter(w => /;\s*["“]/.test(defs[w]));
  console.log(`glosses with an embedded example: ${embedded.length}` +
    (embedded.length ? ` — e.g. ${embedded[0]}: ${defs[embedded[0]]}` : ' (as expected: OEWN keeps them apart)'));

  const ordered = {};
  for (const w of answers) ordered[w] = defs[w];
  fs.writeFileSync(OUT_WORDS, answers.join('\n') + '\n', 'utf8');
  fs.writeFileSync(OUT_DEFS, JSON.stringify(ordered), 'utf8');
  console.log(`done. answers=${answers.length}  coverage=${(100 * answers.length / pool.size).toFixed(1)}% of the pool`);
  for (const p of [OUT_WORDS, OUT_DEFS]) {
    console.log(`  ${path.basename(p)}: ${fs.statSync(p).size} bytes`);
  }
}

main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
