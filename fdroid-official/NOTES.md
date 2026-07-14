# Official F-Droid submission — prep notes

This folder holds a ready-to-use metadata file for submitting Word Guesser to the
**official** F-Droid catalogue (`fdroiddata`). This is a different thing from the
self-hosted repo in `../fdroid/` — here F-Droid's own build servers compile the app
**from your source** and sign it with **F-Droid's** key (not your keystores).

## Three hard prerequisites (must be done first)

1. **Public source repo with a git tag.** Official F-Droid builds from source, so the
   source repo must be **public** and have a tag matching the version, e.g. `v1.0`
   (the metadata's `commit: v1.0`). This conflicts with keeping source private — decide
   before submitting. Note: making source public also exposes the dreamlo write-key
   embedded in `Leaderboard.kt` (already extractable from the APK, but this makes it plain).

2. **A real FOSS license + LICENSE file.** F-Droid only accepts OSI/FSF-approved licenses.
   The metadata currently says `License: MIT` as a **placeholder** — pick a license you're
   happy with (MIT = simple/permissive; GPL-3.0-only = copyleft), add a matching `LICENSE`
   file to the repo root, and set the same SPDX id here. Without this the submission is
   rejected.

3. **Fill in the repo URLs.** Replace every `EDIT-ME` in
   `metadata/com.hrbons.wordguesser.yml` (`SourceCode`, `IssueTracker`, `Repo`) with the
   real public repo URL.

## Likely build tweak

`app/build.gradle` pins `buildToolsVersion '36.0.0'` to reuse the local Unity SDK. F-Droid's
build image may not have that exact build-tools version, which can fail the build. Safest for
the F-Droid build is to **remove that line** (let AGP pick its default) — do this on the
public source repo / tag you submit. It doesn't affect local builds meaningfully.

The release build already degrades gracefully with no secrets present: `signingConfig` is
skipped when `local.properties` has no keystore (F-Droid signs the output itself), and
`GEMINI_KEY` becomes an empty string. So a clean checkout builds without any of your secrets.

## Submission steps

1. Push the public source repo, add the `LICENSE` file, and tag: `git tag v1.0 && git push --tags`.
2. Open a **Request For Packaging** issue: https://gitlab.com/fdroid/rfp/-/issues (describe
   the app, link the repo + license). This is the lightweight entry point.
3. Or go straight to a merge request: fork https://gitlab.com/fdroid/fdroiddata, drop this
   `metadata/com.hrbons.wordguesser.yml` in, and validate locally if you have the tools:
   ```
   fdroid lint com.hrbons.wordguesser
   fdroid build -v -l com.hrbons.wordguesser
   ```
   then open the MR.
4. F-Droid reviews (can take weeks), builds from your tag, signs, and publishes. Future
   releases are picked up automatically via `UpdateCheckMode: Tags` — just push a new
   `vX.Y` tag with a bumped `versionCode`.

## AntiFeatures

The metadata declares `NonFreeNet` because the app downloads word lists, submits leaderboard
scores, and can call the Gemini app — all optional/user-initiated. Reviewers may ask to
adjust the wording; that's normal. Core gameplay works fully offline with the built-in list.
