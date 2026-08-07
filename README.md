# 🟩 Word Guesser

**A tiny, native word-guessing game for Android** — pure Kotlin, no ads, no trackers,
~102&nbsp;KB. Guess the hidden word in six tries.

### ▶️ [**Download → abons.github.io/wordguesser**](https://abons.github.io/wordguesser/)

[![APK](https://img.shields.io/badge/download-APK%20v2.6-16a34a)](https://abons.github.io/wordguesser/apk/com.hrbons.wordguesser_8.apk)
[![releases](https://img.shields.io/badge/all-releases-3f5163)](https://github.com/abons/wordguesser/releases)
![size](https://img.shields.io/badge/APK-~102%20KB-brightgreen)
![Android](https://img.shields.io/badge/Android-5.0%2B-3ddc84)
![no ads](https://img.shields.io/badge/ads-none-black)

<p align="center">
  <img src="assets/screenshot.png" alt="Word Guesser gameplay showing green, yellow and gray letter tiles" width="260">
</p>

## Install

**Direct APK** — [download it](https://abons.github.io/wordguesser/apk/com.hrbons.wordguesser_8.apk)
and open it (you may need to allow "install unknown apps" for your browser).

There is no update channel: this page always carries the newest build, and every release is also
attached to the [releases page](https://github.com/abons/wordguesser/releases). A new APK installs
straight over an older one and keeps your statistics and coins — all versions share one signing key.

## Features

- 🟩 Classic letter-clue scoring — green / yellow / gray, with correct duplicate-letter handling.
- 🌍 **Many languages** via downloadable word lists (English, Nederlands, Français, Deutsch,
  Español, and more) — fetched on demand, cached offline.
- 🔠 **Variable word length** (4–8) — the board resizes to fit.
- 🎯 **Strict mode** (reject non-words) and **hard mode** (numeric hints instead of colours).
- 📅 **Daily puzzle for every word length**, with an optional public leaderboard.
- 📈 Per-language, per-setting **statistics**.
- 🔤 Accent folding with accented display on match; language-specific extra keys (German ß,
  Nordic Æ/Ø, Polish Ł, Croatian Đ).
- ♿ TalkBack accessibility.
- 📶 **Works offline** with the built-in English list; ad-free and tracker-free.

## Why so small?

It's written in **pure Kotlin on the Android framework only** — no AppCompat, Compose,
Material, or third-party runtime libraries. The whole UI is built in code, and word lists
live online instead of being bundled. Result: a ~102&nbsp;KB APK that runs on Android 5.0+.

## Verify the download

APK SHA-256 (v2.6):

```
73679ad7dce400a019a07a481b66b839f0b9fdb57367c526bc08b3d2abf63219
```

## Privacy

No ads, no analytics, no accounts. The app only makes network calls you trigger: downloading
a word list when you pick a language, submitting a daily-puzzle score if you opt in, and word
lookup if you use it. Core play is fully offline.

## Support

If you enjoy it, you can [☕ support the developer on Ko-fi](https://ko-fi.com/hrbons).

---

*This repository hosts the public download page, the APKs it links to, and the
word lists the app downloads at runtime. The app is signed by CN=hrbons. The lists are ©
their respective authors and are mirrored here as filtered derivatives, each under its own
upstream licence — see [`wordlists/SOURCES.md`](wordlists/SOURCES.md) for the full
per-language attribution and [`wordlists/licenses/`](wordlists/licenses/) for the licence
texts.*
