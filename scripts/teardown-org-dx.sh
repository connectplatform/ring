#!/usr/bin/env bash
# Inverse of setup-org-dx.sh — restore Layer1 community tree for GitHub purity.
# Does not invent ring-config content: committed file stays; unlink if somehow re-linked.
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$RING_ROOT/web"

unlink_if_link() {
  local path="$1"
  if [[ -L "$path" ]]; then
    rm -f "$path"
    echo "unlink $path"
  fi
}

# Empire DX links (config must never be a link after Final-Split config SSOT)
unlink_if_link "$WEB/.env.local"
unlink_if_link "$WEB/features/crm/lab"
unlink_if_link "$WEB/features/crm/orders"
unlink_if_link "$WEB/features/calculator"
unlink_if_link "$WEB/app/[locale]/my-orders"
unlink_if_link "$WEB/app/[locale]/my-jobs"
unlink_if_link "$WEB/app/[locale]/admin/crm/orders"
unlink_if_link "$WEB/app/[locale]/calculator"
unlink_if_link "$WEB/app/api/my-orders"
unlink_if_link "$WEB/app/api/my-jobs"
unlink_if_link "$WEB/app/api/admin/crm/orders"
unlink_if_link "$WEB/app/api/calculator"
unlink_if_link "$WEB/lib/payments/conductor/handlers/project-order.ts"
unlink_if_link "$WEB/components/navigation/navigation.tsx"
unlink_if_link "$WEB/components/wrappers/home-wrapper.tsx"
unlink_if_link "$WEB/lib/processes/registry.ts"
unlink_if_link "$WEB/app/api/cron/forgejo-robot-gc"
unlink_if_link "$WEB/app/api/cron/forgejo-token-rotate"
unlink_if_link "$WEB/k8s"
unlink_if_link "$WEB/.forgejo"
unlink_if_link "$WEB/scripts"
unlink_if_link "$WEB/cli"
unlink_if_link "$WEB/docs"

for loc in en uk ru de es; do
  unlink_if_link "$WEB/locales/$loc/calculator.json"
  for f in pages.json navigation.json contact.json seo.json roadmap.json about.json about-publisher.json tokenomics.json; do
    unlink_if_link "$WEB/locales/$loc/$f"
  done
  unlink_if_link "$WEB/locales/$loc/modules/opportunities.json"
done

# If config was re-linked, drop the link so git can show committed file
if [[ -L "$WEB/ring-config.json" ]]; then
  rm -f "$WEB/ring-config.json"
  echo "unlink $WEB/ring-config.json (restore via: git checkout -- web/ring-config.json)"
  if git -C "$RING_ROOT" show HEAD:web/ring-config.json >/dev/null 2>&1; then
    git -C "$RING_ROOT" checkout HEAD -- web/ring-config.json
    echo "restored web/ring-config.json from HEAD"
  fi
fi

# Restore community stubs
PO_COMM="$WEB/lib/payments/conductor/handlers/project-order.community.ts"
PO="$WEB/lib/payments/conductor/handlers/project-order.ts"
if [[ -f "$PO_COMM" ]]; then
  cp "$PO_COMM" "$PO"
  echo "restored project-order.ts from .community.ts"
fi

if [[ -d "$WEB/.locale-stubs" ]]; then
  for loc in en uk ru de es; do
    stub="$WEB/.locale-stubs/calculator.$loc.json"
    if [[ -f "$stub" ]]; then
      mkdir -p "$WEB/locales/$loc"
      cp "$stub" "$WEB/locales/$loc/calculator.json"
      echo "restored locales/$loc/calculator.json from stub"
    fi
  done
fi

if [[ -d "$WEB/.docs-community-hub" ]] && [[ ! -e "$WEB/docs" || -L "$WEB/docs" ]]; then
  unlink_if_link "$WEB/docs"
  mkdir -p "$WEB/docs"
  rsync -a "$WEB/.docs-community-hub/" "$WEB/docs/"
  echo "restored docs hub from .docs-community-hub"
fi

bash "$RING_ROOT/scripts/ensure-community-stubs.sh" || true

echo "[teardown-org-dx] OK — Layer1 community tree restored"
echo "  tip: npm run check:org-leak"
# Note: ring/scripts/ci is not a DX link — empire CI lives at ring-platform-org/scripts/ci
# (npm run ci:layer1 → scripts/run-org-ci.sh).
