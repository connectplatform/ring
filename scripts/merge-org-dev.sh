#!/usr/bin/env bash
# Incremental compose: Layer1 ring/web + ring-platform-org/web → .dev-merge for local empire npm run.
# Empire brand (ring-config) wins via overlay — never mutates Layer1 committed config.
# Preserves node_modules and .next (no rm -rf). Nuclear: RING_DEV_MERGE_WIPE=1.
# Uses --safe-links so DX symlinks in Layer1 are not followed into the merge tree.
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib-ring-paths.sh
source "$RING_ROOT/scripts/lib-ring-paths.sh"
KINGDOM="$(cd "$RING_ROOT/.." && pwd)"
LAYER1="$RING_ROOT/web"
ORG_ROOT="$(ring_clone_root "$KINGDOM" ring-platform-org)" || {
  echo "FATAL: empire overlay missing under $KINGDOM/ringdom-clones/ring-platform-org" >&2
  exit 1
}
ORG_WEB="${RING_ORG_WEB_ROOT:-$ORG_ROOT/web}"
OUT="${RING_ORG_MERGE_OUT:-$ORG_ROOT/.dev-merge}"

test -f "$LAYER1/ring-config.json" && [[ ! -L "$LAYER1/ring-config.json" ]] || {
  echo "FATAL: Layer1 needs committed regular ring-config.json at $LAYER1/ring-config.json" >&2
  exit 1
}
test -f "$ORG_WEB/ring-config.json" || {
  echo "FATAL: org ring-config missing at $ORG_WEB/ring-config.json" >&2
  exit 1
}

ring_compose_dev_merge "$LAYER1" "$OUT" "$ORG_WEB"

if [[ -L "$OUT/ring-config.json" ]]; then
  echo "FATAL: ring-config.json is a symlink after merge" >&2
  exit 1
fi

# Sanity: overlay brand should not be bare localhost community defaults
domain="$(jq -r '.domains.production // empty' "$OUT/ring-config.json" 2>/dev/null || true)"
if [[ "$domain" == "http://localhost:3000" ]]; then
  echo "WARN: merged domains.production is still localhost — org overlay may be missing brand" >&2
fi

echo "[merge-org-dev] $OUT"
echo "  clone=$(jq -r '.clone.name // empty' "$OUT/ring-config.json" 2>/dev/null || true)"
echo "  domain=$domain"
