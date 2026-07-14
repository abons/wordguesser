#!/usr/bin/env bash
# Rebuild + sign the F-Droid repo index for every APK in ./repo/.
# Run this after dropping a new signed app-release.apk into ./repo/ (renamed
# com.hrbons.wordguesser_<versionCode>.apk). Reads the repo-signing keystore
# password from ../../local.properties (gitignored). Requires JDK (jar/jarsigner/
# keytool) + Android build-tools (aapt, apksigner) — same toolchain as the app build.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$HERE/repo"
ROOT="$(cd "$HERE/../.." && pwd)"
LP="$ROOT/local.properties"

get() { grep "^$1=" "$LP" | head -1 | sed "s/^$1=//"; }
SDK="$(get sdk.dir | sed 's#\\#/#g')"
BT="$SDK/build-tools/36.0.0"
AAPT="$BT/aapt.exe"; APKSIGNER="$BT/apksigner.bat"
KS="$ROOT/$(get FDROID_REPO_STORE_FILE)"
KSPASS="$(get FDROID_REPO_STORE_PASSWORD)"
ALIAS="$(get FDROID_REPO_KEY_ALIAS)"

TS=$(( $(date +%s) * 1000 ))

pkgs=""
for apk in "$REPO"/*.apk; do
  [ -e "$apk" ] || { echo "no APKs in $REPO"; exit 1; }
  badging="$("$AAPT" dump badging "$apk")"
  pkg=$(echo "$badging"   | sed -n "s/.*package: name='\([^']*\)'.*/\1/p")
  vc=$(echo "$badging"    | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")
  vn=$(echo "$badging"    | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")
  minsdk=$(echo "$badging"| sed -n "s/.*sdkVersion:'\([^']*\)'.*/\1/p")
  tgtsdk=$(echo "$badging"| sed -n "s/.*targetSdkVersion:'\([^']*\)'.*/\1/p")
  size=$(stat -c %s "$apk")
  sha=$(sha256sum "$apk" | cut -d' ' -f1)
  certs="$("$APKSIGNER" verify --print-certs "$apk")"
  signer=$(echo "$certs" | sed -n 's/.*SHA-256 digest: \([0-9a-f]*\).*/\1/p' | head -1)
  sig=$(echo "$certs"    | sed -n 's/.*MD5 digest: \([0-9a-f]*\).*/\1/p' | head -1)
  entry=$(cat <<PKG
      {
        "packageName": "$pkg",
        "apkName": "$(basename "$apk")",
        "hash": "$sha",
        "hashType": "sha256",
        "versionName": "$vn",
        "versionCode": $vc,
        "size": $size,
        "minSdkVersion": $minsdk,
        "targetSdkVersion": $tgtsdk,
        "sig": "$sig",
        "signer": "$signer",
        "uses-permission": [ ["android.permission.INTERNET", null] ],
        "added": $TS
      }
PKG
)
  pkgs="${pkgs:+$pkgs,}$entry"
  echo "indexed $(basename "$apk"): $pkg v$vn ($vc)"
done

cat > "$REPO/index-v1.json" <<JSON
{
  "repo": {
    "timestamp": $TS,
    "version": 20002,
    "name": "hrbons apps",
    "icon": "fdroid-icon.png",
    "address": "https://EDIT-ME.github.io/fdroid/repo",
    "description": "Personal F-Droid repository for hrbons apps."
  },
  "requests": { "install": [], "uninstall": [] },
  "apps": [
    {
      "packageName": "com.hrbons.wordguesser",
      "name": "Word Guesser",
      "summary": "Tiny native Wordle-style word game",
      "description": "A tiny, native Android word-guessing game (Wordle-style) in pure Kotlin.",
      "license": "Proprietary",
      "categories": ["Games"],
      "added": $TS,
      "lastUpdated": $TS,
      "suggestedVersionName": "1.0",
      "suggestedVersionCode": "1"
    }
  ],
  "packages": {
    "com.hrbons.wordguesser": [
$pkgs
    ]
  }
}
JSON

cd "$REPO"
rm -f index-v1.jar
"$JAVA_HOME/bin/jar.exe" cf index-v1.jar index-v1.json 2>/dev/null || jar cf index-v1.jar index-v1.json
jarsigner -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" \
  -digestalg SHA-256 -sigalg SHA256withRSA index-v1.jar "$ALIAS" >/dev/null
jarsigner -verify index-v1.jar | grep -i 'jar verified' && echo "OK: index-v1.jar signed"
