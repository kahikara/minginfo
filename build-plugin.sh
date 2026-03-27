#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

readarray -t BUILD_META < <(
python3 <<'PY'
import json
import re
from pathlib import Path
import sys

manifest_path = Path("manifest.json")
package_path = Path("package.json")

if not manifest_path.exists():
    print("ERROR: manifest.json fehlt", file=sys.stderr)
    sys.exit(1)

if not package_path.exists():
    print("ERROR: package.json fehlt", file=sys.stderr)
    sys.exit(1)

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
package = json.loads(package_path.read_text(encoding="utf-8"))

manifest_version = str(manifest.get("Version", "")).strip()
package_version = str(package.get("version", "")).strip()
manifest_name = str(manifest.get("Name", "")).strip()
package_name = str(package.get("name", "")).strip()

if not manifest_version:
    print("ERROR: manifest.json Version fehlt", file=sys.stderr)
    sys.exit(1)

if not package_version:
    print("ERROR: package.json version fehlt", file=sys.stderr)
    sys.exit(1)

if manifest_version != package_version:
    print(
        f"ERROR: Versionskonflikt, manifest={manifest_version}, package={package_version}",
        file=sys.stderr
    )
    sys.exit(1)

if not manifest_name:
    print("ERROR: manifest.json Name fehlt", file=sys.stderr)
    sys.exit(1)

slug = manifest_name.lower()
slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')
if not slug:
    print("ERROR: konnte keinen gueltigen Slug aus dem Plugin Namen bauen", file=sys.stderr)
    sys.exit(1)

print(manifest_version)
print(manifest_name)
print(slug)
print(package_name)
PY
)

VERSION="${BUILD_META[0]}"
PLUGIN_NAME="${BUILD_META[1]}"
PLUGIN_SLUG="${BUILD_META[2]}"
PACKAGE_NAME="${BUILD_META[3]}"

OUT_DIR="$SCRIPT_DIR/dist"
STAGE_DIR="$OUT_DIR/$PLUGIN_SLUG"
ZIP_NAME="$PLUGIN_SLUG-v$VERSION.zip"

echo "Building $PLUGIN_NAME"
echo "Version: $VERSION"
echo "Package: $PACKAGE_NAME"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp manifest.json "$STAGE_DIR/"
cp package.json "$STAGE_DIR/"
[ -f package-lock.json ] && cp package-lock.json "$STAGE_DIR/"
cp index.js "$STAGE_DIR/"
cp start.sh "$STAGE_DIR/"
cp build-plugin.sh "$STAGE_DIR/"
cp -r icons "$STAGE_DIR/"

chmod +x "$STAGE_DIR/start.sh"
chmod +x "$STAGE_DIR/build-plugin.sh"

rm -f "$OUT_DIR/$ZIP_NAME"
(
  cd "$OUT_DIR"
  zip -qr "$ZIP_NAME" "$PLUGIN_SLUG"
)

echo "Built: $OUT_DIR/$ZIP_NAME"
