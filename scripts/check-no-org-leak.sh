#!/usr/bin/env bash
# Fail if org-only surfaces are real (non-symlink) empire trees in Layer1 web — GitHub gate.
# Community may keep thin stubs under features/crm/orders/* and payment handler stubs.
# ring-config.json MUST be a committed regular file (never a DX symlink to empire).
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="${RING_WEB_ROOT:-$RING_ROOT/web}"
fail=0

check_absent_or_link() {
  local p="$1"
  if [[ -e "$WEB/$p" && ! -L "$WEB/$p" ]]; then
    echo "ORG LEAK: $p is a real path in ring/web (must be absent or symlink to ring-platform-org)" >&2
    fail=1
  fi
}

# Layer1 community brand — committed file, never empire DX symlink
check_must_be_file() {
  local p="$1"
  local full="$WEB/$p"
  if [[ ! -e "$full" ]]; then
    echo "ORG LEAK: $p missing (Layer1 must commit a real ring-config.json)" >&2
    fail=1
    return
  fi
  if [[ -L "$full" ]]; then
    echo "ORG LEAK: $p is a symlink (empire DX bleed — must be a committed regular file)" >&2
    fail=1
    return
  fi
  if [[ ! -f "$full" ]]; then
    echo "ORG LEAK: $p is not a regular file" >&2
    fail=1
    return
  fi
  if ! jq -e . "$full" >/dev/null 2>&1; then
    echo "ORG LEAK: $p is not valid JSON" >&2
    fail=1
  fi
}

# Full empire product trees must not be committed as real dirs
check_absent_or_link features/crm/lab
check_absent_or_link features/calculator
check_absent_or_link "app/[locale]/my-orders"
check_absent_or_link "app/[locale]/my-jobs"
check_absent_or_link "app/[locale]/admin/crm/orders"
check_absent_or_link "app/[locale]/calculator"
check_absent_or_link "app/[locale]/deployment-calculator"
check_absent_or_link app/api/my-orders
check_absent_or_link app/api/my-jobs
check_absent_or_link app/api/admin/crm/orders
check_absent_or_link app/api/calculator
check_absent_or_link k8s
check_absent_or_link .forgejo
check_absent_or_link .env.local
check_absent_or_link scripts
check_absent_or_link cli

check_must_be_file ring-config.json

# Stubs allowed: features/crm/orders/*.ts (thin), project-order handler stub, CTA stub
if [[ -d "$WEB/features/crm/orders" && ! -L "$WEB/features/crm/orders" ]]; then
  if [[ -f "$WEB/features/crm/orders/project-order-service.ts" ]]; then
    sz=$(wc -c < "$WEB/features/crm/orders/project-order-service.ts" | tr -d ' ')
    if [[ "$sz" -gt 2000 ]]; then
      echo "ORG LEAK: features/crm/orders/project-order-service.ts looks like full empire impl ($sz bytes)" >&2
      fail=1
    fi
  fi
fi

if [[ -f "$WEB/REFERRAL-ONCHAIN-OPS.md" ]]; then
  echo "ORG LEAK: REFERRAL-ONCHAIN-OPS.md" >&2
  fail=1
fi

# Broken DX symlinks must not ship / break community builds
while IFS= read -r link; do
  [[ -z "$link" ]] && continue
  if [[ ! -e "$link" ]]; then
    echo "ORG LEAK: broken symlink $link" >&2
    fail=1
  fi
done < <(find "$WEB" \( -path '*/node_modules/*' -o -path '*/.next/*' \) -prune -o -type l -print 2>/dev/null)

# Layer1 GitHub must not contain Reggie exclude (destination-only)
if [[ -f "$WEB/.reggie-propagate-exclude.json" ]]; then
  echo "ORG LEAK: web/.reggie-propagate-exclude.json (belongs on white-label/org destinations)" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "[check-no-org-leak] OK"
