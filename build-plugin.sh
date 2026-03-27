#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUT_DIR="$SCRIPT_DIR/dist"
STAGE_DIR="$OUT_DIR/redline-monitor"
ZIP_NAME="redline-monitor-v1.1.0.zip"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

cp manifest.json "$STAGE_DIR/"
cp package.json "$STAGE_DIR/"
cp package-lock.json "$STAGE_DIR/"
cp index.js "$STAGE_DIR/"
cp start.sh "$STAGE_DIR/"
cp -r icons "$STAGE_DIR/"

chmod +x "$STAGE_DIR/start.sh"

rm -f "$OUT_DIR/$ZIP_NAME"
(
  cd "$OUT_DIR"
  zip -qr "$ZIP_NAME" redline-monitor
)

echo "Built: $OUT_DIR/$ZIP_NAME"
