# Publishing Word Guesser

> 🛑 **Obsolete as of 2026-08-16.** All four games had their APKs removed from public GitHub — from
> the release assets and from `apk/` on the landing page — and Google Play becomes the only channel.
> Nothing below that copies an APK into `apk/` or attaches one to a release should be carried out any
> more. The signed builds still exist: each `<game>-src` release carries an archive copy, and for
> Word Guesser those copies were created on that same date (`v2.3`–`v2.6`), because until then the
> public release was the only place its APKs lived. The rest of this file is kept as the record of
> how the direct-download setup worked.

Two separate repos, on purpose:

| Repo | Visibility | Contains | Purpose |
|---|---|---|---|
| **source** (this whole project) | **private** | Kotlin source, keystores (gitignored) | your code + backup |
| **dist** (just this `dist/` folder) | **public** | landing page + signed APKs + word lists | public download |

Keeping them split means the app stays **publicly downloadable** without making your
source public. (Until v2.4 the source also embedded the dreamlo leaderboard write-key, which made
the split load-bearing; the leaderboard now authorises with server-side database rules, so keeping
source private is a business choice rather than a secrecy requirement.)

> ⛔ **F-Droid was dropped for every app on 2026-08-07 (user's decision).** The self-hosted repo that
> used to live in `fdroid/` — one shared URL and fingerprint for all four games — is gone, and so are
> the prep notes for the official catalogue in `fdroid-official/` (that route was already closed on
> 2026-07-29). The reasoning for both is kept in the source repo's `design.md`. What follows is the
> flow that replaced it: a page with an APK on it. The `fdroid-repo.keystore` is no longer used by
> anything; **`release.keystore` is still the app signing key and still must never be lost.**

---

## 1. Public dist repo → GitHub Pages (findable + downloadable)

Already set up and live at <https://abons.github.io/wordguesser/>. For a fresh host, from the
project root:

```bash
cd dist
git init -b main
git add .
git commit -m "Word Guesser — site + APK"
gh repo create wordguesser --public --source=. --push
# enable GitHub Pages on the default branch, root folder:
gh api -X POST repos/{owner}/wordguesser/pages -f source.branch=main -f source.path=/ 2>/dev/null || \
  echo "Enable Pages manually: repo Settings -> Pages -> Deploy from branch: main / (root)"
```

- **Direct APK download:** `https://<you>.github.io/wordguesser/apk/com.hrbons.wordguesser_<versionCode>.apk`
- Only the **current** APK of each game is hosted. Older builds stay in this repo's git history and,
  from v2.3 on, as GitHub release assets.

Any static host works too (Netlify, Cloudflare Pages, your own server): just serve the
`dist/` folder. Nothing on the page is generated at request time.

## 2. Private source repo (backup + versioning)

```bash
git init -b main
git add .
git commit -m "Word Guesser 1.0"
gh repo create wordguesser-src --private --source=. --push
```

`.gitignore` already excludes `local.properties`, `*.keystore`, `*.jks`, and build output, so no
keystore and no signing password gets pushed. ⚠️ That is **not** the same as "no secrets": a key
hard-coded in a source file is tracked like any other line of code. Grep the sources for keys
before you make a repo public, not just `git status`.

### A GitHub Release with the APK attached (part of every release since v2.3)

In the **public** dist repo, so the download link is public. Attach the APK you already
published — never a rebuild, or two different sets of bytes end up under one version number:

```bash
cd dist
gh release create v2.6 apk/com.hrbons.wordguesser_8.apk \
  --target "$(git rev-parse HEAD)" \
  -t "Word Guesser 2.6" --notes-file notes.md
```

`--target` needs a branch name or a **full** SHA; a short one fails with HTTP 422. The APK is also a
tracked file in `apk/`, because that is what the landing page links to.

---

## Shipping an update later

1. Bump `versionCode` (and `versionName`) in `app/build.gradle`.
2. `install-release.bat` (or `gradlew.bat assembleRelease`) — same keystore.
3. Copy the new APK into `dist/apk/` as `com.hrbons.wordguesser_<versionCode>.apk`, and
   `git rm` the previous one — the page links exactly one per game.
4. Update `index.html`: the download button, the JSON-LD `downloadUrl` + `softwareVersion`, the
   SHA-256, the pill in the games list, and the size **only if the rounded KB actually moved**
   (it appears five times, one of them with `&nbsp;` — grep the bare number).
5. Commit & push the dist repo, tag it, and attach the APK to a GitHub release.
6. Verify against the live host, not your local files: fetch the APK from Pages and hash it.

## Adding another app to the page

1. Drop the signed APK into `apk/` as `<packageName>_<versionCode>.apk`.
2. Add a row to the games list in `index.html` with a download pill and a releases link.
3. Commit & push the dist repo.

**Never delete or lose `release.keystore`** (app signing; path in `local.properties`, outside every
repo) — without it no future build can update an installed app, because Android refuses an update
signed by a different key.
