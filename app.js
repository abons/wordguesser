"use strict";
(() => {
  // src/core/javaHash.ts
  function javaHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0;
    return h;
  }

  // src/core/daily.ts
  function dayUtc(nowMs) {
    return Math.floor(nowMs / 864e5);
  }
  function dailyIndex(day, len, poolSize, langCode) {
    const p = BigInt(poolSize);
    const sum = BigInt(day) * 1000003n + BigInt(len * 131) + BigInt(javaHash(langCode));
    return Number((sum % p + p) % p);
  }

  // src/core/dateKeys.ts
  function dayKey(nowMs) {
    const d = new Date(nowMs);
    const p = (n, w) => String(n).padStart(w, "0");
    return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1, 2)}${p(d.getUTCDate(), 2)}`;
  }

  // src/core/dailyRecord.ts
  function encodeRecord(r) {
    return [r.won ? "W" : "L", r.seconds, r.guessCount, r.target, r.guesses.join(",")].join("|");
  }
  function decodeRecord(raw) {
    const parts = raw.split("|");
    const int = (s) => {
      const n = Number.parseInt(s ?? "", 10);
      return Number.isNaN(n) ? 0 : n;
    };
    return {
      won: parts[0] === "W",
      seconds: int(parts[1]),
      guessCount: int(parts[2]),
      target: parts[3] ?? "",
      guesses: (parts[4] ?? "").split(",").filter((g) => g.trim().length > 0)
    };
  }
  function encodeProgress(p) {
    return `${p.startMs}|${p.guesses.join(",")}`;
  }
  function decodeProgress(raw, fallbackStartMs) {
    const parts = raw?.split("|");
    const n = Number.parseInt(parts?.[0] ?? "", 10);
    return {
      startMs: Number.isNaN(n) ? fallbackStartMs : n,
      guesses: (parts?.[1] ?? "").split(",").filter((g) => g.trim().length > 0)
    };
  }

  // src/core/lang.ts
  var MIRROR = "https://abons.github.io/wordguesser/wordlists";
  var LANGUAGES = [
    {
      code: "en",
      badge: "EN",
      label: "English (large)",
      url: `${MIRROR}/en-v1.txt`,
      extra: "",
      fold: false,
      minLen: 4,
      maxLen: 8
    },
    {
      code: "nl",
      badge: "NL",
      label: "Nederlands",
      url: `${MIRROR}/nl.txt`,
      acceptUrl: `${MIRROR}/nl-accept.txt`,
      defsUrl: `${MIRROR}/nl-defs.json`,
      extra: "",
      fold: false,
      minLen: 4,
      maxLen: 8
    }
  ];
  function languageByCode(code) {
    const lang = LANGUAGES.find((l) => l.code === code);
    if (!lang) throw new Error(`unknown language: ${code}`);
    return lang;
  }

  // src/core/config.ts
  var FIREBASE_DB_URL = "https://wordguesser-42b54-default-rtdb.europe-west1.firebasedatabase.app";
  var CONTENT_POLICY_URL = "https://abons.github.io/wordguesser/policy/content-policy.html";
  var COINS_PURCHASABLE = false;
  var PACKS = [];

  // src/core/leaderboard.ts
  var ROWS = 6;
  function enabled() {
    return FIREBASE_DB_URL.trim().length > 0;
  }
  var HttpError = class extends Error {
    constructor(code) {
      super(code === 401 ? "HTTP 401 \u2014 database rules refused it" : `HTTP ${code}`);
      this.code = code;
    }
  };
  var NameTakenError = class extends Error {
    constructor(name) {
      super(`Name '${name}' is already taken on this board`);
      this.name = name;
    }
  };
  function sanitizeName(raw) {
    const cleaned = raw.toUpperCase().split("").filter((c) => c >= "A" && c <= "Z" || c >= "0" && c <= "9").join("").slice(0, 10);
    return cleaned.length > 0 ? cleaned : "ANON";
  }
  var base = () => FIREBASE_DB_URL.replace(/\/+$/, "");
  var sliceUrl = (lang, day, len) => `${base()}/scores/${lang}/${day}/${len}.json`;
  var scoreUrl = (lang, day, len, name) => `${base()}/scores/${lang}/${day}/${len}/${name}.json`;
  async function requestOnce(method, url, body) {
    if (!enabled()) throw new Error("No leaderboard backend configured");
    const resp = await fetch(url, {
      method,
      ...body !== null ? { body, headers: { "Content-Type": "application/json; charset=utf-8" } } : {}
    });
    if (!resp.ok) throw new HttpError(resp.status);
    return await resp.text();
  }
  async function request(method, url, body) {
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await requestOnce(method, url, body);
      } catch (e) {
        if (e instanceof HttpError) throw e;
        last = e;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    throw last instanceof Error ? last : new Error("Request failed");
  }
  function echoesSubmission(existing, sent) {
    let there;
    try {
      there = JSON.parse(existing);
    } catch {
      return false;
    }
    if (typeof there !== "object" || there === null) return false;
    const mine = JSON.parse(sent);
    const t = there;
    return Object.keys(mine).every((k) => typeof t[k] === "number" && t[k] === mine[k]);
  }
  async function putAppendOnly(url, body, name) {
    try {
      await request("PUT", url, body);
    } catch (e) {
      if (!(e instanceof HttpError) || e.code !== 401) throw e;
      const existing = await request("GET", url, null);
      if (existing.trim().length === 0 || existing === "null") throw e;
      if (!echoesSubmission(existing, body)) throw new NameTakenError(name);
    }
  }
  async function submit(name, guesses, seconds, langCode, dateKey, len) {
    const body = JSON.stringify({
      guesses: Math.min(Math.max(guesses, 1), ROWS),
      seconds: Math.max(0, Math.min(seconds, 86400))
    });
    const key2 = sanitizeName(name);
    await putAppendOnly(scoreUrl(langCode, dateKey, len, key2), body, key2);
  }
  async function fetchBoard(langCode, dateKey, len) {
    return rank(await request("GET", sliceUrl(langCode, dateKey, len), null));
  }
  function rank(body) {
    const out = [];
    for (const [name, o] of children(body)) {
      const guesses = typeof o["guesses"] === "number" ? o["guesses"] : -1;
      if (guesses < 1) continue;
      const seconds = typeof o["seconds"] === "number" ? Math.max(0, o["seconds"]) : 0;
      out.push({ name, guesses, seconds });
    }
    out.sort((a, b) => a.guesses - b.guesses || a.seconds - b.seconds || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  }
  function children(body) {
    if (body.trim().length === 0 || body === "null") return [];
    let o;
    try {
      o = JSON.parse(body);
    } catch {
      return [];
    }
    if (typeof o !== "object" || o === null) return [];
    return Object.entries(o).filter((e) => typeof e[1] === "object" && e[1] !== null);
  }
  var REPORT_REASONS = ["offensive", "impersonation", "other"];
  function dailySlice(langCode, dateKey, len) {
    return `${langCode}/${dateKey}/${len}`;
  }
  function reportBody(name, board, slice, reason) {
    return JSON.stringify({ name, board, slice, reason });
  }
  async function reportDaily(name, langCode, dateKey, len, reason) {
    await request("POST", `${base()}/reports.json`, reportBody(sanitizeName(name), "daily", dailySlice(langCode, dateKey, len), reason));
  }

  // src/core/scoring.ts
  var ST_ABSENT = 0;
  var ST_PRESENT = 1;
  var ST_CORRECT = 2;
  function evaluate(guess, target) {
    const n = guess.length;
    const result = new Array(n).fill(ST_ABSENT);
    const remaining = /* @__PURE__ */ new Map();
    for (const c of target.split("")) remaining.set(c, (remaining.get(c) ?? 0) + 1);
    for (let i = 0; i < n; i++) {
      const c = guess[i];
      if (i < target.length && c === target[i]) {
        result[i] = ST_CORRECT;
        remaining.set(c, remaining.get(c) - 1);
      }
    }
    for (let i = 0; i < n; i++) {
      if (result[i] === ST_ABSENT) {
        const c = guess[i];
        if ((remaining.get(c) ?? 0) > 0) {
          result[i] = ST_PRESENT;
          remaining.set(c, remaining.get(c) - 1);
        }
      }
    }
    return result;
  }

  // src/core/share.ts
  var URL2 = "https://abons.github.io/wordguesser/";
  var SQ_CORRECT = "\u{1F7E9}";
  var SQ_PRESENT = "\u{1F7E8}";
  var SQ_ABSENT = "\u2B1B";
  var SQ_CORRECT_HC = "\u{1F7E7}";
  var SQ_PRESENT_HC = "\u{1F7E6}";
  function row(states, highContrast = false) {
    let out = "";
    for (const s of states) {
      out += s === ST_CORRECT ? highContrast ? SQ_CORRECT_HC : SQ_CORRECT : s === ST_PRESENT ? highContrast ? SQ_PRESENT_HC : SQ_PRESENT : SQ_ABSENT;
    }
    return out;
  }
  function grid(guesses, target, highContrast = false) {
    return guesses.map((g) => row(evaluate(g, target), highContrast)).join("\n");
  }
  function score(guessCount, rows, solved, hardMode) {
    return (solved ? String(guessCount) : "X") + "/" + rows + (hardMode ? "*" : "");
  }
  function time(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function language(label) {
    const i = label.indexOf(" (");
    return (i >= 0 ? label.substring(0, i) : label).trim();
  }
  function resultText(opts) {
    const head = opts.dailyDate ? `${opts.appName} \u2014 Daily ${opts.dailyDate}` : opts.appName;
    const facts = [
      language(opts.langLabel),
      `${opts.target.length} letters`,
      score(opts.guesses.length, opts.rows, opts.solved, opts.hardMode ?? false),
      ...opts.seconds != null ? [time(opts.seconds)] : []
    ].join(" \xB7 ");
    return `${head}
${facts}

${grid(opts.guesses, opts.target, opts.highContrast ?? false)}

${URL2}`;
  }

  // src/core/economy.ts
  var START_BALANCE = 2;
  var SAVE_THRESHOLD = 5;
  var SAVE_COST = 1;
  function canOfferSave(streak, balance) {
    return streak >= SAVE_THRESHOLD && balance >= SAVE_COST;
  }
  function streakAfterLoss(streak, saved) {
    return saved ? streak : 0;
  }
  function shouldEarnDaily(lastEarnDay, today) {
    return today > (lastEarnDay ?? "");
  }

  // src/core/stats.ts
  function lossIdx(rows) {
    return rows;
  }
  function curStreakIdx(rows) {
    return rows + 1;
  }
  function bestStreakIdx(rows) {
    return rows + 2;
  }
  function parse(raw, rows) {
    const nums = new Array(rows + 3).fill(0);
    if (raw !== null) {
      const parts = raw.split(",");
      for (let i = 0; i < nums.length; i++) {
        const n = Number.parseInt(parts[i] ?? "", 10);
        nums[i] = Number.isNaN(n) ? 0 : n;
      }
    }
    return nums;
  }
  function format(nums) {
    return nums.join(",");
  }
  function afterWin(raw, guessRow, rows) {
    const nums = parse(raw, rows);
    nums[Math.min(Math.max(guessRow, 0), rows - 1)]++;
    nums[curStreakIdx(rows)]++;
    if (nums[curStreakIdx(rows)] > nums[bestStreakIdx(rows)]) {
      nums[bestStreakIdx(rows)] = nums[curStreakIdx(rows)];
    }
    return format(nums);
  }
  function afterLoss(raw, saved, rows) {
    const nums = parse(raw, rows);
    nums[lossIdx(rows)]++;
    nums[curStreakIdx(rows)] = streakAfterLoss(nums[curStreakIdx(rows)], saved);
    return format(nums);
  }

  // src/core/clean.ts
  var COMBINING = /\p{Mn}+/gu;
  function stripDiacritics(s) {
    return s.normalize("NFD").replace(COMBINING, "");
  }
  function upperNoExpand(s) {
    let out = "";
    for (const c of s) {
      const u = c.toUpperCase();
      out += u.length === 1 ? u : c;
    }
    return out;
  }
  var UPPER = /\p{Lu}/u;
  function clean(raw, s) {
    let w = raw;
    const slash = w.indexOf("/");
    if (slash >= 0) w = w.substring(0, slash);
    w = w.trim();
    if (w.length === 0) return null;
    for (const c of w) if (UPPER.test(c)) return null;
    const folded = s.fold ? stripDiacritics(w) : w;
    if (folded.length < s.minLen || folded.length > s.maxLen) return null;
    for (const c of folded) {
      const uc = c.toUpperCase();
      const u = uc.length === 1 ? uc : c;
      if (!(u.length === 1 && u >= "A" && u <= "Z") && !s.extra.includes(u)) return null;
    }
    return upperNoExpand(w);
  }
  function typeableForm(word, s) {
    const base2 = s.fold ? stripDiacritics(word) : word;
    return upperNoExpand(base2);
  }

  // src/core/profanity.ts
  var BY_LANG = /* @__PURE__ */ new Map([
    ["en", /* @__PURE__ */ new Set([
      // slurs
      "nigger",
      "nigga",
      "faggot",
      "kike",
      "spic",
      "chink",
      "coon",
      "dago",
      "gook",
      "wetback",
      "retard",
      "retards",
      "tranny",
      "paki",
      "wop",
      "gyp",
      "gypped",
      "cripple",
      // coarse
      "fuck",
      "fucks",
      "fucked",
      "fucker",
      "fuckers",
      "fucking",
      "shit",
      "shits",
      "shitty",
      "shite",
      "cunt",
      "cunts",
      "twat",
      "twats",
      "piss",
      "pissed",
      "pisser",
      "bitch",
      "bitches",
      "bastard",
      "bugger",
      "bollock",
      "bollocks",
      "arse",
      "arsehole",
      "asshole",
      "wanker",
      "prick",
      "pricks",
      "slut",
      "sluts",
      "whore",
      "whores",
      "hooker",
      "damn",
      "damned",
      "crap",
      "crappy",
      "goddamn",
      // sexual / anatomical
      "penis",
      "vagina",
      "vulva",
      "clitoris",
      "scrotum",
      "testicle",
      "testicles",
      "semen",
      "sperm",
      "orgasm",
      "erection",
      "condom",
      "dildo",
      "porn",
      "porno",
      "horny",
      "boner",
      "cock",
      "cocks",
      "dick",
      "dicks",
      "pussy",
      "anus",
      "rectum",
      "sodomy",
      "felching",
      "fellatio",
      "cunnilingus",
      "masturbate",
      "incest",
      "rape",
      "raped",
      "rapist",
      "rapes",
      "molest",
      "molested",
      "pedophile",
      "prostitute",
      "brothel"
    ])],
    ["nl", /* @__PURE__ */ new Set([
      // slurs
      "neger",
      "negers",
      "negerin",
      "flikker",
      "flikkers",
      "mongool",
      "mongolen",
      "spleetoog",
      "kaffer",
      "zwartjoekel",
      "poepchinees",
      // coarse — the Dutch disease words are the strong ones
      "kanker",
      "kankers",
      "tering",
      "tyfus",
      "klere",
      "pleuris",
      "godver",
      "godverdomme",
      "kut",
      "kutten",
      "lul",
      "lullen",
      "eikel",
      "eikels",
      "klootzak",
      "kloten",
      "schijt",
      "schijten",
      "stront",
      "zeik",
      "zeiken",
      "pisnijdig",
      "pissen",
      "reet",
      "kont",
      "poep",
      "poepen",
      "verdomme",
      "sukkel",
      "debiel",
      // sexual / anatomical
      "neuken",
      "neukt",
      "wippen",
      "hoer",
      "hoeren",
      "slet",
      "sletten",
      "penis",
      "vagina",
      "kutje",
      "piemel",
      "ballen",
      "sperma",
      "orgasme",
      "erectie",
      "condoom",
      "porno",
      "geil",
      "geile",
      "borsten",
      "tepel",
      "tepels",
      "anus",
      "aars",
      "verkrachten",
      "verkracht",
      "incest",
      "pedofiel",
      "prostituee",
      "bordeel"
    ])]
  ]);
  function normalizeLang(code) {
    return code === "en_builtin" ? "en" : code;
  }
  function isBlocked(word, langCode) {
    const set2 = BY_LANG.get(normalizeLang(langCode));
    return set2 !== void 0 && set2.has(word.toLowerCase());
  }
  function keepPickable(words, langCode) {
    const set2 = BY_LANG.get(normalizeLang(langCode));
    if (set2 === void 0 || set2.size === 0) return words;
    return words.filter((w) => !set2.has(w.toLowerCase()));
  }

  // src/core/wordIndex.ts
  function answersFromRaw(raw, lang) {
    const out = /* @__PURE__ */ new Set();
    for (const line of raw.split("\n")) {
      const w = clean(line, lang);
      if (w !== null) out.add(w);
    }
    return [...out];
  }
  function dailyPool(answersAll2, lang) {
    const groups = /* @__PURE__ */ new Map();
    for (const orig of keepPickable(answersAll2, lang.code)) {
      const w = orig.trim();
      if (w.length === 0) continue;
      const len = typeableForm(w, lang).length;
      let list = groups.get(len);
      if (!list) groups.set(len, list = []);
      list.push(w);
    }
    for (const list of groups.values()) list.sort();
    return groups;
  }
  function isAccented(orig, typed2) {
    return orig.toLowerCase() !== typed2.toLowerCase();
  }
  function forLength(answersAll2, lang, len) {
    const answers = [];
    const answersTyped = /* @__PURE__ */ new Set();
    const typedToOriginal = /* @__PURE__ */ new Map();
    const pickable = [];
    for (const orig of answersAll2) {
      const typed2 = typeableForm(orig, lang);
      if (typed2.length !== len) continue;
      answers.push(orig);
      answersTyped.add(typed2);
      if (!isBlocked(orig, lang.code)) pickable.push(orig);
      const existing = typedToOriginal.get(typed2);
      if (existing === void 0 || isAccented(orig, typed2) && !isAccented(existing, typed2)) {
        typedToOriginal.set(typed2, orig);
      }
    }
    return { answers, answersTyped, typedToOriginal, pickable };
  }
  function acceptForLength(acceptAll2, lang, len) {
    const set2 = /* @__PURE__ */ new Set();
    for (const orig of acceptAll2) {
      const typed2 = typeableForm(orig, lang);
      if (typed2.length === len) set2.add(typed2);
    }
    return set2;
  }

  // src/storage.ts
  function get(key2) {
    try {
      return localStorage.getItem(key2);
    } catch {
      return null;
    }
  }
  function set(key2, value) {
    try {
      localStorage.setItem(key2, value);
    } catch {
    }
  }
  function remove(key2) {
    try {
      localStorage.removeItem(key2);
    } catch {
    }
  }
  var dailyKey = (lang, day, len) => `daily_${lang}_${day}_${len}`;
  var dailyProgKey = (lang, day, len) => `dailyprog_${lang}_${day}_${len}`;
  var statsKey = (lang, len) => `stats_${lang}|${len}|-|-`;
  var PREF_NAME = "player_name";

  // src/purchase.ts
  var SESSION_RE = /^cs_[A-Za-z0-9_]{8,200}$/;
  function sessionIdFromSearch(search) {
    const cs = new URLSearchParams(search).get("cs");
    return cs !== null && SESSION_RE.test(cs) ? cs : null;
  }
  var claimedKey = (sessionId) => `claimed_${sessionId}`;
  async function redeem(sessionId, fetchFn = fetch, attempts = 5, delayMs = 2e3) {
    if (get(claimedKey(sessionId)) !== null) return { kind: "already" };
    const base2 = FIREBASE_DB_URL.replace(/\/+$/, "");
    try {
      let purchase = null;
      for (let i = 0; i < attempts; i++) {
        const resp = await fetchFn(`${base2}/purchases/${sessionId}.json`);
        if (!resp.ok) return { kind: "failed", message: `HTTP ${resp.status} reading the purchase` };
        const body = await resp.json();
        if (typeof body === "object" && body !== null) {
          purchase = body;
          break;
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
      }
      if (purchase === null) return { kind: "pending" };
      const coins2 = typeof purchase.coins === "number" ? Math.floor(purchase.coins) : 0;
      if (coins2 < 1) return { kind: "failed", message: "the purchase record carries no coins" };
      const claim = await fetchFn(`${base2}/claims/${sessionId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at: { ".sv": "timestamp" } })
      });
      if (claim.status === 401) return { kind: "already" };
      if (!claim.ok) return { kind: "failed", message: `HTTP ${claim.status} writing the claim` };
      set(claimedKey(sessionId), String(coins2));
      return { kind: "credited", coins: coins2 };
    } catch (e) {
      return { kind: "failed", message: e.message };
    }
  }

  // src/wallet.ts
  var PREF_COINS = "coins";
  var PREF_COINS_EARN_DAY = "coins_earn_day";
  function parseBalance(raw) {
    if (raw === null) return START_BALANCE;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? START_BALANCE : Math.max(0, n);
  }
  function coins() {
    return parseBalance(get(PREF_COINS));
  }
  function setCoins(n) {
    set(PREF_COINS, String(Math.max(0, n)));
  }
  function addCoins(n) {
    setCoins(coins() + n);
  }
  function spendCoins(n) {
    setCoins(Math.max(0, coins() - n));
  }
  function maybeEarnDailyCoin(today) {
    if (!shouldEarnDaily(get(PREF_COINS_EARN_DAY), today)) return false;
    set(PREF_COINS_EARN_DAY, today);
    addCoins(1);
    return true;
  }

  // src/main.ts
  var APP_NAME = "Word Guesser";
  var MAX_GUESSES = 6;
  var KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  var listCache = /* @__PURE__ */ new Map();
  var acceptCache = /* @__PURE__ */ new Map();
  async function fetchList(url) {
    const name = url.split("/").pop();
    try {
      const local = await fetch(`wordlists/${name}`);
      if (local.ok) return await local.text();
    } catch {
    }
    const remote = await fetch(url);
    if (!remote.ok) throw new Error(`HTTP ${remote.status} for ${name}`);
    return await remote.text();
  }
  async function answersAll(lang) {
    let all = listCache.get(lang.code);
    if (!all) {
      all = answersFromRaw(await fetchList(lang.url), lang);
      listCache.set(lang.code, all);
    }
    return all;
  }
  async function acceptAll(lang) {
    if (!lang.acceptUrl) return [];
    let all = acceptCache.get(lang.code);
    if (!all) {
      all = answersFromRaw(await fetchList(lang.acceptUrl), lang);
      acceptCache.set(lang.code, all);
    }
    return all;
  }
  var app = document.getElementById("app");
  var game = null;
  var typed = "";
  var accept = null;
  var answersLen = null;
  function restoreStates(g) {
    g.states = g.guesses.map((guess) => evaluate(guess, g.targetTyped));
  }
  async function newGame(langCode, mode, len) {
    const lang = languageByCode(langCode);
    const all = await answersAll(lang);
    const g = {
      lang,
      mode,
      len,
      day: null,
      target: "",
      targetTyped: "",
      guesses: [],
      states: [],
      startMs: Date.now(),
      done: false,
      won: false,
      recordedSeconds: null
    };
    if (mode === "daily") {
      g.day = dayKey(Date.now());
      const pool = dailyPool(all, lang).get(len) ?? [];
      if (pool.length === 0) throw new Error(`no words of length ${len}`);
      g.target = pool[dailyIndex(dayUtc(Date.now()), len, pool.length, lang.code)];
      g.targetTyped = typeableForm(g.target, lang);
      const record = get(dailyKey(lang.code, g.day, len));
      if (record !== null) {
        const r = decodeRecord(record);
        g.guesses = r.guesses.map((w) => typeableForm(w, lang));
        restoreStates(g);
        g.done = true;
        g.won = r.won;
        g.recordedSeconds = r.seconds;
        return g;
      }
      const prog = decodeProgress(get(dailyProgKey(lang.code, g.day, len)), Date.now());
      g.startMs = prog.startMs;
      g.guesses = prog.guesses.filter((w) => w.length === len);
      restoreStates(g);
      if (g.guesses.length === 0) {
        set(dailyProgKey(lang.code, g.day, len), encodeProgress({ startMs: g.startMs, guesses: [] }));
      }
    } else {
      const pickable = forLength(all, lang, len).pickable;
      if (pickable.length === 0) throw new Error(`no words of length ${len}`);
      g.target = pickable[Math.floor(Math.random() * pickable.length)];
      g.targetTyped = typeableForm(g.target, lang);
    }
    return g;
  }
  function finishGame(g, won, saved = false) {
    g.done = true;
    g.won = won;
    const bucket = statsKey(g.lang.code, g.len);
    const raw = get(bucket);
    set(bucket, won ? afterWin(raw, g.guesses.length - 1, MAX_GUESSES) : afterLoss(raw, saved, MAX_GUESSES));
    let note = "";
    if (g.mode === "daily" && g.day !== null) {
      const seconds = Math.max(0, Math.round((Date.now() - g.startMs) / 1e3));
      g.recordedSeconds = seconds;
      const result = { won, seconds, guessCount: g.guesses.length, target: g.target, guesses: g.guesses };
      set(dailyKey(g.lang.code, g.day, g.len), encodeRecord(result));
      remove(dailyProgKey(g.lang.code, g.day, g.len));
      if (won && maybeEarnDailyCoin(g.day)) note = "\u{1FA99} +1 coin \xB7 daily";
    }
    return note;
  }
  function el(tag, cls, text = "") {
    const e = document.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function button(label, cls, onClick) {
    const b = el("button", cls, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function stateClass(s) {
    return s === ST_CORRECT ? "correct" : s === ST_PRESENT ? "present" : "absent";
  }
  function render(message = "") {
    app.textContent = "";
    const g = game;
    if (!g) return;
    const header = el("div", "header");
    header.append(el("div", "title", APP_NAME));
    header.append(el(
      "div",
      "status",
      `${g.mode === "daily" ? `Daily ${g.day}` : "Free play"} \xB7 ${g.lang.badge} \xB7 ${g.len} \xB7 \u{1FA99} ${coins()}`
    ));
    app.append(header);
    const board = el("div", "board");
    for (let row2 = 0; row2 < MAX_GUESSES; row2++) {
      const r = el("div", "row");
      const guess = g.guesses[row2] ?? (row2 === g.guesses.length && !g.done ? typed : "");
      const states = g.states[row2];
      for (let i = 0; i < g.len; i++) {
        r.append(el("div", "tile" + (states ? " " + stateClass(states[i] ?? ST_ABSENT) : ""), guess[i] ?? ""));
      }
      board.append(r);
    }
    app.append(board);
    app.append(el("div", "message", message || (g.done ? g.won ? `Solved in ${g.guesses.length} \u2014 it was ${g.target}` : `Out of guesses \u2014 it was ${g.target}` : "")));
    const actions = el("div", "actionrow");
    if (g.done) actions.append(button("Share", "action", showShare));
    actions.append(button("\u{1F4CA} Stats", "action", showStats));
    actions.append(button("\u{1FA99} Coins", "action", showCoinInfo));
    if (g.mode === "daily" && enabled()) actions.append(button("\u{1F3C6} Board", "action", () => void showBoard()));
    app.append(actions);
    const best = /* @__PURE__ */ new Map();
    g.guesses.forEach((guess, gi) => {
      for (let i = 0; i < guess.length; i++) {
        const c = guess[i];
        best.set(c, Math.max(best.get(c) ?? -1, g.states[gi]?.[i] ?? ST_ABSENT));
      }
    });
    const kb = el("div", "keyboard");
    KEY_ROWS.forEach((rowKeys, i) => {
      const r = el("div", "krow");
      if (i === 2) r.append(key("ENTER", "wide"));
      for (const c of rowKeys) {
        const s = best.get(c);
        r.append(key(c, s === void 0 ? "" : stateClass(s)));
      }
      if (i === 2) r.append(key("\u232B", "wide"));
      kb.append(r);
    });
    app.append(kb);
  }
  function key(label, cls) {
    return button(label, ("key " + cls).trim(), () => onKey(label));
  }
  function onKey(label) {
    const g = game;
    if (!g || g.done) return;
    if (label === "ENTER") {
      submit2();
      return;
    }
    if (label === "\u232B" || label === "BACKSPACE") {
      typed = typed.slice(0, -1);
      render();
      return;
    }
    if (label.length === 1 && typed.length < g.len) {
      typed += label;
      render();
    }
  }
  function submit2() {
    const g = game;
    if (!g || g.done || !answersLen) return;
    if (typed.length !== g.len) {
      render("Too short");
      return;
    }
    if (!answersLen.answersTyped.has(typed) && !(accept?.has(typed) ?? false)) {
      render("Not a word");
      return;
    }
    const states = evaluate(typed, g.targetTyped);
    g.guesses.push(typed);
    g.states.push(states);
    typed = "";
    const solved = states.every((s) => s === ST_CORRECT);
    if (g.mode === "daily" && g.day !== null && !solved && g.guesses.length < MAX_GUESSES) {
      set(dailyProgKey(g.lang.code, g.day, g.len), encodeProgress({ startMs: g.startMs, guesses: g.guesses }));
    }
    if (solved) {
      render(finishGame(g, true));
    } else if (g.guesses.length >= MAX_GUESSES) {
      recordLossWithStreakSave(g);
    } else {
      render();
    }
  }
  function recordLossWithStreakSave(g) {
    const streak = parse(get(statsKey(g.lang.code, g.len)), MAX_GUESSES)[curStreakIdx(MAX_GUESSES)];
    if (!canOfferSave(streak, coins())) {
      finishGame(g, false);
      render();
      return;
    }
    render();
    const overlay = el("div", "overlay");
    const modal = el("div", "modal");
    modal.append(el("div", "modaltitle", `Streak of ${streak} breaks`));
    modal.append(el("div", "statline", "\u{1F6E1}\uFE0F Spend a coin to keep your streak alive?"));
    let handled = false;
    const finish = (saved) => {
      if (handled) return;
      handled = true;
      overlay.remove();
      if (saved) {
        spendCoins(SAVE_COST);
        finishGame(g, false, true);
        render(`\u{1F6E1}\uFE0F Streak saved \xB7 ${streak}`);
      } else {
        finishGame(g, false);
        render();
      }
    };
    modal.append(button(`Spend (you have ${coins()})`, "action", () => finish(true)));
    modal.append(button("Let it go", "action", () => finish(false)));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) finish(false);
    });
    overlay.append(modal);
    document.body.append(overlay);
  }
  function showCoinInfo() {
    const modal = showModal("Coins");
    modal.append(el(
      "div",
      "statline",
      `\u{1FA99} ${coins()} coins

Solve the daily to earn a coin \u2014 once a day. Lose a game with a streak of ${SAVE_THRESHOLD}+ and you can spend a coin to keep the streak alive instead of it resetting to zero.`
    ));
    if (COINS_PURCHASABLE && PACKS.length > 0) {
      for (const pack of PACKS) {
        modal.append(button(pack.label, "action", () => {
          window.location.href = pack.url;
        }));
      }
      modal.append(el(
        "div",
        "statline",
        "Payments are handled by Stripe on their own page \u2014 the game never sees your card."
      ));
    }
  }
  async function maybeRedeemPurchase() {
    if (!COINS_PURCHASABLE) return null;
    const sessionId = sessionIdFromSearch(window.location.search);
    if (sessionId === null) return null;
    const outcome = await redeem(sessionId);
    if (outcome.kind !== "pending") {
      const url = new URL(window.location.href);
      url.searchParams.delete("cs");
      history.replaceState(null, "", url);
    }
    switch (outcome.kind) {
      case "credited":
        addCoins(outcome.coins);
        return `\u{1FA99} +${outcome.coins} coins \u2014 thank you!`;
      case "already":
        return "This purchase was already redeemed.";
      case "pending":
        return "Payment made? The confirmation is still on its way \u2014 reload in a moment.";
      case "failed":
        return `Could not redeem the purchase (${outcome.message}).`;
    }
  }
  function showModal(title) {
    const overlay = el("div", "overlay");
    const modal = el("div", "modal");
    const head = el("div", "modalhead");
    head.append(el("div", "modaltitle", title));
    head.append(button("\u2715", "action", () => overlay.remove()));
    modal.append(head);
    overlay.append(modal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.append(overlay);
    return modal;
  }
  function showShare() {
    const g = game;
    if (!g || !g.done) return;
    const text = resultText({
      appName: APP_NAME,
      langLabel: g.lang.label,
      guesses: g.guesses,
      target: g.targetTyped,
      rows: MAX_GUESSES,
      solved: g.won,
      dailyDate: g.day,
      seconds: g.mode === "daily" ? g.recordedSeconds : null
    });
    const modal = showModal("Share");
    modal.append(el("pre", "sharetext", text));
    modal.append(button("Copy", "action", () => {
      void navigator.clipboard?.writeText(text).catch(() => {
      });
    }));
    if (typeof navigator.share === "function") {
      modal.append(button("Share\u2026", "action", () => void navigator.share({ text }).catch(() => {
      })));
    }
  }
  function showStats() {
    const g = game;
    if (!g) return;
    const nums = parse(get(statsKey(g.lang.code, g.len)), MAX_GUESSES);
    const losses = nums[lossIdx(MAX_GUESSES)];
    const wins = nums.slice(0, MAX_GUESSES).reduce((a, b) => a + b, 0);
    const modal = showModal(`Stats \xB7 ${g.lang.badge} \xB7 ${g.len}`);
    modal.append(el(
      "div",
      "statline",
      `Played ${wins + losses} \xB7 Won ${wins} \xB7 Streak ${nums[curStreakIdx(MAX_GUESSES)]} \xB7 Best ${nums[bestStreakIdx(MAX_GUESSES)]}`
    ));
    const maxCount = Math.max(1, ...nums.slice(0, MAX_GUESSES));
    for (let i = 0; i < MAX_GUESSES; i++) {
      const rowEl = el("div", "statrow");
      rowEl.append(el("span", "statnum", String(i + 1)));
      const bar = el("div", "statbar", String(nums[i]));
      bar.style.width = `${Math.max(8, Math.round(nums[i] / maxCount * 100))}%`;
      rowEl.append(bar);
      modal.append(rowEl);
    }
    modal.append(el("div", "statline", `Losses ${losses}`));
  }
  async function showBoard() {
    const g = game;
    if (!g || g.mode !== "daily" || g.day === null) return;
    const day = g.day;
    const modal = showModal(`Daily board \xB7 ${g.lang.badge} \xB7 ${day} \xB7 ${g.len}`);
    const status = el("div", "statline", "Loading\u2026");
    modal.append(status);
    const list = el("div", "boardlist");
    const refresh = (note = "") => {
      status.textContent = note || "Loading\u2026";
      fetchBoard(g.lang.code, day, g.len).then((entries) => {
        status.textContent = note || (entries.length === 0 ? "Nobody on the board yet." : "");
        list.textContent = "";
        entries.slice(0, 25).forEach((entry, i) => {
          const rowEl = el("div", "boardrow");
          rowEl.append(el("span", "boardrank", `${i + 1}.`));
          rowEl.append(el("span", "boardname", entry.name));
          rowEl.append(el("span", "boardscore", `${entry.guesses}/6 \xB7 ${entry.seconds}s`));
          rowEl.append(button("\u2691", "flag", () => reportFlow(entry.name)));
          list.append(rowEl);
        });
      }).catch((e) => {
        status.textContent = `Could not load the board: ${e.message}`;
      });
    };
    const reportFlow = (name) => {
      const m = showModal(`Report ${name}`);
      m.append(el("div", "statline", "Why should this name be reviewed?"));
      const policy = el("a", "policylink", "Content policy \u2014 what gets removed, and how fast \u2197");
      policy.href = CONTENT_POLICY_URL;
      policy.target = "_blank";
      policy.rel = "noopener";
      m.append(policy);
      for (const reason of REPORT_REASONS) {
        m.append(button(reason, "action", () => {
          m.parentElement?.remove();
          status.textContent = "Reporting\u2026";
          reportDaily(name, g.lang.code, day, g.len, reason).then(() => {
            status.textContent = "Reported \u2014 thank you.";
          }).catch((e) => {
            status.textContent = `Report failed: ${e.message}`;
          });
        }));
      }
    };
    const record = get(dailyKey(g.lang.code, day, g.len));
    const result = record !== null ? decodeRecord(record) : null;
    if (result?.won) {
      const rowEl = el("div", "submitrow");
      const name = document.createElement("input");
      name.className = "nameinput";
      name.maxLength = 10;
      name.placeholder = "NAME";
      name.value = get(PREF_NAME) ?? "";
      rowEl.append(name);
      rowEl.append(button("Submit score", "action", () => {
        const chosen = sanitizeName(name.value);
        set(PREF_NAME, chosen);
        status.textContent = "Submitting\u2026";
        submit(chosen, result.guessCount, result.seconds, g.lang.code, day, g.len).then(() => refresh(`Placed as ${chosen}.`)).catch((e) => {
          status.textContent = e instanceof NameTakenError ? `${e.name} is taken on today's board \u2014 pick another name.` : `Submit failed: ${e.message}`;
        });
      }));
      modal.append(rowEl);
    }
    modal.append(list);
    refresh();
  }
  async function start(langCode, mode, len) {
    app.textContent = "";
    app.append(el("div", "message", "Loading word list\u2026"));
    try {
      game = await newGame(langCode, mode, len);
      const all = await answersAll(game.lang);
      answersLen = forLength(all, game.lang, len);
      accept = acceptForLength(await acceptAll(game.lang), game.lang, len);
      typed = "";
      render();
    } catch (e) {
      app.textContent = "";
      app.append(el("div", "message", `Could not load the word list (${e.message}). Are you offline?`));
    }
  }
  function wireControls() {
    const langSel = document.getElementById("lang");
    const lenSel = document.getElementById("len");
    for (const lang of LANGUAGES) {
      const o = document.createElement("option");
      o.value = lang.code;
      o.textContent = lang.badge;
      langSel.append(o);
    }
    for (let len = 4; len <= 8; len++) {
      const o = document.createElement("option");
      o.value = String(len);
      o.textContent = String(len);
      if (len === 5) o.selected = true;
      lenSel.append(o);
    }
    const current = () => [langSel.value, Number(lenSel.value)];
    document.getElementById("daily").addEventListener("click", () => {
      const [l, n] = current();
      void start(l, "daily", n);
    });
    document.getElementById("free").addEventListener("click", () => {
      const [l, n] = current();
      void start(l, "free", n);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target?.tagName === "INPUT") return;
      if (e.key === "Enter") onKey("ENTER");
      else if (e.key === "Backspace") onKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    });
  }
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("sw.js");
  }
  wireControls();
  void (async () => {
    const purchaseNote = await maybeRedeemPurchase();
    await start("en", "daily", 5);
    if (purchaseNote !== null) render(purchaseNote);
  })();
})();
