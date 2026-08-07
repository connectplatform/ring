#!/usr/bin/env bash
# Ensure ring/web/ring-config.json is the committed community SSOT (regular file).
# Does not overwrite an existing regular file. Rejects empire DX symlinks.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$SCRIPT_DIR/../web" && pwd)"
bash "$SCRIPT_DIR/ensure-community-stubs.sh" || true
cd "$WEB"

if [[ -L ring-config.json ]]; then
  echo "FATAL: ring-config.json is a symlink (empire DX). Run: npm run teardown:org-dx" >&2
  echo "  Layer1 must keep a committed regular file; empire brand applies at merge only." >&2
  exit 1
fi

if [[ -f ring-config.json ]]; then
  exit 0
fi

# Greenfield / broken tree — seed from template only (community.json retired after promote)
if [[ -f ring-config.template.json ]]; then
  cp ring-config.template.json ring-config.json
  echo "[ensure-ring-config] seeded from ring-config.template.json (commit Layer1 defaults next)"
  exit 0
fi

echo "FATAL: no ring-config.json (expected committed Layer1 community SSOT)" >&2
exit 1
