#!/usr/bin/env bash
# Rebuild + sign the F-Droid repo index for every APK in ./repo/.
#
# The repo is deliberately shared by all hrbons apps (one URL, one fingerprint, one
# keystore), so this script is multi-app: APKs are grouped by the package name read
# from the APK itself, and each package gets its own "apps" entry and its own version
# list. Human-written fields (name, summary, description, license, categories) come
# from ./apps/<packageName>.meta — one small shell-sourceable file per app. Everything
# else (version, size, hash, signer, SDK levels, permissions) is derived from the APK,
# so a release can never disagree with the index about what it actually is.
#
# Run this after dropping a new signed app-release.apk into ./repo/ (renamed
# <packageName>_<versionCode>.apk). Adding a new app = drop its APK + write its .meta;
# a missing .meta is a hard error rather than an app published without a name.
#
# Reads the repo-signing keystore password from ../../local.properties (gitignored).
# Requires JDK (jar/jarsigner) + Android build-tools (aapt, apksigner) — same toolchain
# as the app build.
#
# Known wart, unchanged from the single-app version: "added" is stamped with the current
# run for every app and APK, so each rebuild makes everything look newly added (it only
# affects "what's new" sorting in F-Droid clients). Fixing it means persisting first-seen
# timestamps; not worth a JSON reader in bash yet.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$HERE/repo"
APPS="$HERE/apps"
ROOT="$(cd "$HERE/../.." && pwd)"
LP="$ROOT/local.properties"

get() { grep "^$1=" "$LP" | head -1 | sed "s/^$1=//"; }
SDK="$(get sdk.dir | sed 's#\\#/#g')"
BT="$SDK/build-tools/36.0.0"
AAPT="$BT/aapt.exe"; APKSIGNER="$BT/apksigner.bat"
# The keystore now lives outside every repo, so the property holds an absolute path.
# Still accept a project-relative one for older local.properties files.
KS="$(get FDROID_REPO_STORE_FILE | sed 's#\\#/#g')"
case "$KS" in /*|[A-Za-z]:/*) ;; *) KS="$ROOT/$KS" ;; esac
KSPASS="$(get FDROID_REPO_STORE_PASSWORD)"
ALIAS="$(get FDROID_REPO_KEY_ALIAS)"

TS=$(( $(date +%s) * 1000 ))

# Minimal JSON string escaping for the hand-written metadata fields.
jstr() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

declare -A ENTRIES MAXVC MAXVN

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
  # Permissions come from the APK, so the index cannot understate what an app asks for.
  perms=""
  while read -r p; do
    [ -n "$p" ] || continue
    perms="${perms:+$perms, }[\"$p\", null]"
  done < <(echo "$badging" | sed -n "s/^uses-permission: name='\([^']*\)'.*/\1/p")
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
        "uses-permission": [ $perms ],
        "added": $TS
      }
PKG
)
  ENTRIES[$pkg]="${ENTRIES[$pkg]:+${ENTRIES[$pkg]},}$entry"
  if [ "${MAXVC[$pkg]:-0}" -lt "$vc" ]; then MAXVC[$pkg]=$vc; MAXVN[$pkg]=$vn; fi
  echo "indexed $(basename "$apk"): $pkg v$vn ($vc)"
done

# Deterministic app order, so a rebuild with no new APK produces the same index.
mapfile -t pkglist < <(printf '%s\n' "${!ENTRIES[@]}" | sort)

apps_json=""
packages_json=""
for pkg in "${pkglist[@]}"; do
  meta="$APPS/$pkg.meta"
  [ -f "$meta" ] || { echo "missing metadata: $meta (write it before publishing $pkg)"; exit 1; }
  NAME=""; SUMMARY=""; DESCRIPTION=""; LICENSE=""; CATEGORIES=""
  # shellcheck source=/dev/null
  . "$meta"
  for field in NAME SUMMARY DESCRIPTION LICENSE CATEGORIES; do
    [ -n "${!field}" ] || { echo "$meta: $field is empty"; exit 1; }
  done
  app=$(cat <<APP
    {
      "packageName": "$pkg",
      "name": "$(jstr "$NAME")",
      "summary": "$(jstr "$SUMMARY")",
      "description": "$(jstr "$DESCRIPTION")",
      "license": "$(jstr "$LICENSE")",
      "categories": $CATEGORIES,
      "added": $TS,
      "lastUpdated": $TS,
      "suggestedVersionName": "${MAXVN[$pkg]}",
      "suggestedVersionCode": "${MAXVC[$pkg]}"
    }
APP
)
  apps_json="${apps_json:+$apps_json,
}$app"
  packages_json="${packages_json:+$packages_json,
}    \"$pkg\": [
${ENTRIES[$pkg]}
    ]"
  echo "app $pkg -> $NAME (suggested v${MAXVN[$pkg]} / ${MAXVC[$pkg]})"
done

cat > "$REPO/index-v1.json" <<JSON
{
  "repo": {
    "timestamp": $TS,
    "version": 20002,
    "name": "hrbons apps",
    "icon": "fdroid-icon.png",
    "address": "https://abons.github.io/wordguesser/fdroid/repo",
    "description": "Personal F-Droid repository for hrbons apps."
  },
  "requests": { "install": [], "uninstall": [] },
  "apps": [
$apps_json
  ],
  "packages": {
$packages_json
  }
}
JSON

cd "$REPO"
rm -f index-v1.jar
"$JAVA_HOME/bin/jar.exe" cf index-v1.jar index-v1.json 2>/dev/null || jar cf index-v1.jar index-v1.json
# -digestalg SHA1 is NOT an oversight (2026-07-31). With SHA-256 the official F-Droid client
# refuses the repo outright, in Settings > additional repositories:
#   "Foute vingerafdruk / org.fdroid.index.signingException: Unsupported digest: SHA-256-Digest"
# Its index-v1 verifier only knows SHA1-Digest in the JAR manifest -- F-Droid signs its own index
# with SHA1withRSA and has an open issue to move up (fdroidclient#1989). The SIGNATURE stays
# SHA256withRSA, only the per-entry manifest digest is SHA1, and the signing cert is untouched, so
# the repo fingerprint in the add-URL does not change. Revisit when F-Droid accepts SHA-256.
jarsigner -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" \
  -digestalg SHA1 -sigalg SHA256withRSA index-v1.jar "$ALIAS" >/dev/null
jarsigner -verify index-v1.jar | grep -i 'jar verified' && echo "OK: index-v1.jar signed"
