#!/usr/bin/env bash
# Wire ring/web → ring-platform-org for local empire DX (symlinks; gitignored).
# Uses ABSOLUTE symlink targets to avoid nested-path relative-depth bugs.
set -euo pipefail
RING_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib-ring-paths.sh
source "$RING_ROOT/scripts/lib-ring-paths.sh"
KINGDOM="$(cd "$RING_ROOT/.." && pwd)"
WEB="$RING_ROOT/web"
ORG_ROOT="$(ring_clone_root "$KINGDOM" ring-platform-org)" || {
  echo "FATAL: missing empire overlay at $KINGDOM/ringdom-clones/ring-platform-org" >&2
  exit 1
}
ORG_WEB="${RING_ORG_WEB_ROOT:-$ORG_ROOT/web}"

test -d "$ORG_WEB" || { echo "FATAL: missing $ORG_WEB" >&2; exit 1; }
mkdir -p "$WEB/features/crm" "$WEB/lib/overlay" "$WEB/lib/payments/conductor/handlers" "$WEB/components/home"

link() { # link <absolute-target> <path>
  local target="$1" path="$2"
  mkdir -p "$(dirname "$path")"
  rm -rf "$path"
  ln -sfn "$target" "$path"
  if [[ ! -e "$path" ]]; then
    echo "WARN: broken link $path → $target" >&2
  else
    echo "link $path → $target"
  fi
}

# Secrets + Order Lab (NOT ring-config — Layer1 commits community ring-config.json;
# empire brand wins only at compose merge / .dev-merge)
link "$ORG_WEB/.env.local" "$WEB/.env.local"
link "$ORG_WEB/features/crm/lab" "$WEB/features/crm/lab"

# Layer3 distribution / project_order / calculator (overwrites community stubs)
link "$ORG_WEB/features/crm/orders" "$WEB/features/crm/orders"
link "$ORG_WEB/features/calculator" "$WEB/features/calculator"
link "$ORG_WEB/app/[locale]/my-orders" "$WEB/app/[locale]/my-orders"
link "$ORG_WEB/app/[locale]/my-jobs" "$WEB/app/[locale]/my-jobs"
link "$ORG_WEB/app/[locale]/admin/crm/orders" "$WEB/app/[locale]/admin/crm/orders"
link "$ORG_WEB/app/[locale]/calculator" "$WEB/app/[locale]/calculator"
link "$ORG_WEB/app/api/my-orders" "$WEB/app/api/my-orders"
link "$ORG_WEB/app/api/my-jobs" "$WEB/app/api/my-jobs"
link "$ORG_WEB/app/api/admin/crm/orders" "$WEB/app/api/admin/crm/orders"
link "$ORG_WEB/app/api/calculator" "$WEB/app/api/calculator"
link "$ORG_WEB/lib/payments/conductor/handlers/project-order.ts" \
  "$WEB/lib/payments/conductor/handlers/project-order.ts"

# Opt-in local empire nav/home/registry: RING_ORG_DX_NAV=1
if [[ "${RING_ORG_DX_NAV:-0}" == "1" ]]; then
  link "$ORG_WEB/components/navigation/navigation.tsx" "$WEB/components/navigation/navigation.tsx"
  link "$ORG_WEB/components/wrappers/home-wrapper.tsx" "$WEB/components/wrappers/home-wrapper.tsx"
  link "$ORG_WEB/lib/processes/registry.ts" "$WEB/lib/processes/registry.ts"
fi

if [[ -d "$ORG_WEB/app/api/cron/forgejo-robot-gc" ]]; then
  link "$ORG_WEB/app/api/cron/forgejo-robot-gc" "$WEB/app/api/cron/forgejo-robot-gc"
fi
if [[ -d "$ORG_WEB/app/api/cron/forgejo-token-rotate" ]]; then
  link "$ORG_WEB/app/api/cron/forgejo-token-rotate" "$WEB/app/api/cron/forgejo-token-rotate"
fi

# Calculator locales: stash community stubs, then link empire JSON for DX.
mkdir -p "$WEB/.locale-stubs"
for loc in en uk ru de es; do
  if [[ -f "$ORG_WEB/locales/$loc/calculator.json" ]]; then
    stub="$WEB/locales/$loc/calculator.json"
    if [[ -f "$stub" && ! -L "$stub" ]]; then
      cp "$stub" "$WEB/.locale-stubs/calculator.$loc.json"
    fi
    link "$ORG_WEB/locales/$loc/calculator.json" "$stub"
  fi
done

# Ops — do NOT replace ring/scripts/ci with an org symlink (destroys Layer1 tree /
# breaks ORG_ROOT resolution). Empire CI stays at ring-platform-org/scripts/ci;
# use npm run ci:layer1 → scripts/run-org-ci.sh.
link "$ORG_ROOT/k8s" "$WEB/k8s"
link "$ORG_ROOT/.forgejo" "$WEB/.forgejo"
link "$RING_ROOT/scripts" "$WEB/scripts"
link "$RING_ROOT/cli" "$WEB/cli"

# Product docs: default OFF — keep committed hub. Opt-in: RING_ORG_DX_DOCS=1
if [[ "${RING_ORG_DX_DOCS:-0}" == "1" ]] && [[ -d "$ORG_WEB/docs" ]]; then
  if [[ -d "$WEB/docs" && ! -L "$WEB/docs" ]]; then
    mkdir -p "$WEB/.docs-community-hub"
    rsync -a --delete "$WEB/docs/" "$WEB/.docs-community-hub/"
    echo "stashed community docs hub → $WEB/.docs-community-hub"
  fi
  link "$ORG_WEB/docs" "$WEB/docs"
fi

if [[ "${RING_ORG_DX_LOCALES:-0}" == "1" ]]; then
  for loc in en uk ru de es; do
    if [[ -d "$ORG_WEB/locales/$loc" ]]; then
      mkdir -p "$WEB/locales/$loc"
      for f in pages.json navigation.json contact.json seo.json roadmap.json about.json about-publisher.json tokenomics.json; do
        if [[ -f "$ORG_WEB/locales/$loc/$f" ]]; then
          link "$ORG_WEB/locales/$loc/$f" "$WEB/locales/$loc/$f"
        fi
      done
      if [[ -f "$ORG_WEB/locales/$loc/modules/opportunities.json" ]]; then
        mkdir -p "$WEB/locales/$loc/modules"
        link "$ORG_WEB/locales/$loc/modules/opportunities.json" \
          "$WEB/locales/$loc/modules/opportunities.json"
      fi
    fi
  done
fi

echo "[setup-org-dx] OK — empire overlay linked into ring/web"
echo "  secrets: $ORG_WEB/.env.local"
echo "  ring-config: Layer1 committed file kept (empire brand via merge / npm run dev -- ring-platform-org)"
echo "  community env template remains: $WEB/env.local.template"
