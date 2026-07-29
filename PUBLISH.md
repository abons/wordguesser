# Publishing Word Guesser

Two separate repos, on purpose:

| Repo | Visibility | Contains | Purpose |
|---|---|---|---|
| **source** (this whole project) | **private** | Kotlin source, keystores (gitignored) | your code + backup |
| **dist** (just this `dist/` folder) | **public** | landing page + signed APK + F-Droid index | public download + F-Droid updates |

Keeping them split means the app stays **publicly downloadable** without making your
source (which embeds the dreamlo write-key) public.

> `gh` (GitHub CLI) is not installed here and login is interactive, so run these
> yourself. Install once: `winget install GitHub.cli`, then `gh auth login`.

---

## 1. Public dist repo → GitHub Pages (findable + downloadable)

From the project root:

```bash
# make a clean folder that will become the PUBLIC repo (only dist/ contents)
cd dist
git init -b main
git add .
git commit -m "Word Guesser 1.0 — site + F-Droid repo"
gh repo create wordguesser --public --source=. --push
# enable GitHub Pages on the default branch, root folder:
gh api -X POST repos/{owner}/wordguesser/pages -f source.branch=main -f source.path=/ 2>/dev/null || \
  echo "Enable Pages manually: repo Settings -> Pages -> Deploy from branch: main / (root)"
```

After Pages goes live (~1 min) you get a public site, e.g.
`https://<you>.github.io/wordguesser/`

- **Direct APK download:** `https://<you>.github.io/wordguesser/fdroid/repo/com.hrbons.wordguesser_1.apk`
- **F-Droid repo URL** (auto-shown on the landing page): `https://<you>.github.io/wordguesser/fdroid/repo`
- **Fingerprint:** `C74E4BC48DBE3CCF800A859BC5A9118B23A19BA38C8B33573DBA1BDEB7E456EE`

The landing page (`index.html`) builds the F-Droid add-URL from wherever it's hosted,
so there's nothing to edit. (Optional: set the real URL in `fdroid/repo/index-v1.json`
`address` field and re-run `fdroid/rebuild-index.sh` — cosmetic only.)

Any static host works too (Netlify, Cloudflare Pages, your own server): just serve the
`dist/` folder.

## 2. Private source repo (backup + versioning)

From the project root:

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
gh release create v2.3 fdroid/repo/com.hrbons.wordguesser_5.apk \
  --target "$(git rev-parse HEAD)" \
  -t "Word Guesser 2.3 — the scenic-backdrop release" --notes-file notes.md
```

`--target` needs a branch name or a **full** SHA; a short one fails with HTTP 422. The APK stays
a tracked file in `fdroid/repo/` as well — this repo is also the F-Droid host, so it can't move
the bytes into releases the way the sibling repos do.

---

## Shipping an update later

1. Bump `versionCode` (and `versionName`) in `app/build.gradle`.
2. `install-release.bat` (or `gradlew.bat assembleRelease`) — same keystore.
3. Copy the new APK into `dist/fdroid/repo/` as `com.hrbons.wordguesser_<versionCode>.apk`
   (keep the old one so users on older Android still resolve a version).
4. Run `bash dist/fdroid/rebuild-index.sh` to regenerate + re-sign the index.
5. Commit & push the dist repo. F-Droid clients pick up the update automatically.

## Adding another app to the same repo

The F-Droid repo is deliberately shared by all hrbons apps — one URL, one fingerprint, one
`fdroid-repo.keystore` — so existing subscribers get a new app automatically instead of
having to add a second repo.

1. Write `fdroid/apps/<packageName>.meta` (name, summary, description, license, categories).
   It is sourced by `rebuild-index.sh`; a missing file is a hard error, so no app can be
   published nameless. Everything else — version, size, hash, signer, SDK levels,
   permissions — is read from the APK, so the index cannot disagree with the release.
2. Drop the signed APK into `fdroid/repo/` as `<packageName>_<versionCode>.apk`.
3. `bash fdroid/rebuild-index.sh` — APKs are grouped by the package name from the APK, and
   each app gets its own version list and its own `suggestedVersionCode`.
4. Add the app to the landing page, then commit & push the dist repo.

**Never delete or lose** `fdroid-repo.keystore` (repo index signing) or `release.keystore`
(app signing) — both live outside every repo (path in `local.properties`) and are required
for updates to be trusted.
