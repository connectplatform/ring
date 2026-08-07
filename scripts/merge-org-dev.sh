#!/usr/bin/env bash
# Merge Layer1 ring/web + ring-platform-org/web into .dev-merge for local empire npm run.
# Empire brand (ring-config) wins via overlay — never mutates Layer1 committed config.
# Uses --safe-links so DX symlinks in Layer1 are not followed into the merge tree.
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KINGDOM="$(cd "$RING_ROOT/.." && pwd)"
LAYER1="$RING_ROOT/web"
ORG_ROOT="$KINGDOM/ring-platform-org"
ORG_WEB="${RING_ORG_WEB_ROOT:-$ORG_ROOT/web}"
OUT="${RING_ORG_MERGE_OUT:-$ORG_ROOT/.dev-merge}"

test -d "$LAYER1" || { echo "FATAL: Layer1 missing at $LAYER1" >&2; exit 1; }
test -d "$ORG_WEB" || { echo "FATAL: org overlay missing at $ORG_WEB" >&2; exit 1; }
test -f "$LAYER1/ring-config.json" && [[ ! -L "$LAYER1/ring-config.json" ]] || {
  echo "FATAL: Layer1 needs committed regular ring-config.json at $LAYER1/ring-config.json" >&2
  exit 1
}
test -f "$ORG_WEB/ring-config.json" || {
  echo "FATAL: org ring-config missing at $ORG_WEB/ring-config.json" >&2
  exit 1
}

rm -rf "$OUT"
mkdir -p "$OUT"

# Layer1 community tree — skip DX/empire link targets & secrets; KEEP ring-config (overlay overwrites)
rsync -a --safe-links \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude '.env' --exclude '.env.*' \
  --exclude features/calculator \
  --exclude features/crm \
  --exclude 'app/[locale]/my-orders' \
  --exclude 'app/[locale]/my-jobs' \
  --exclude 'app/[locale]/admin/crm' \
  --exclude 'app/[locale]/calculator' \
  --exclude 'app/[locale]/deployment-calculator' \
  --exclude app/api/my-orders \
  --exclude app/api/my-jobs \
  --exclude app/api/admin/crm \
  --exclude app/api/calculator \
  --exclude app/api/cron/forgejo-robot-gc \
  --exclude app/api/cron/forgejo-token-rotate \
  --exclude lib/payments/conductor/handlers/project-order.ts \
  --exclude cli --exclude scripts --exclude k8s --exclude .forgejo \
  "$LAYER1/" "$OUT/"

# Overlay wins (includes empire ring-config, Order Lab, calculator, .env.local if present)
rsync -a --safe-links \
  --exclude node_modules --exclude .next --exclude .git \
  "$ORG_WEB/" "$OUT/"

if [[ ! -f "$OUT/package.json" ]] || [[ ! -f "$OUT/ring-config.json" ]]; then
  echo "FATAL: merge incomplete (need package.json + ring-config.json in $OUT)" >&2
  exit 1
fi

# Guard: no empire calculator symlink leaked from Layer1 DX
if [[ -L "$OUT/features/calculator" ]]; then
  echo "FATAL: features/calculator is still a symlink (empire DX leak)" >&2
  exit 1
fi
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
