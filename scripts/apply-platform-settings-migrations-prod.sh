#!/usr/bin/env bash
# Apply platform_settings table (011) to prod Postgres on k3s-or (Oregon).
#
# Usage:
#   ./scripts/apply-platform-settings-migrations-prod.sh
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-platform-settings-migrations-prod.sh
#
# Requires: kctl k3s-or (Oregon). Do not use k3s-1 (Ashburn) for ring-platform.org.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/011_platform_settings.sql"
NS="${K8S_NAMESPACE:-ring-platform-org}"
DB="${POSTGRES_DB:-ring_platform}"
USER="${POSTGRES_USER:-ring_user}"
KCTL="${KCTL_BIN:-kctl}"
CLUSTER="${K3S_CLUSTER:-k3s-or}"

if ! command -v "$KCTL" >/dev/null 2>&1; then
  echo "ERROR: kctl not found (expected ~/.local/bin/kctl)"
  exit 1
fi

echo "Finding postgres pod in $CLUSTER namespace $NS..."
POD="$("$KCTL" "$CLUSTER" get pods -n "$NS" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$POD" ]]; then
  POD="$("$KCTL" "$CLUSTER" get pods -n "$NS" -o name 2>/dev/null | rg 'postgres' | head -1 | sed 's|pod/||')"
fi
if [[ -z "$POD" ]]; then
  echo "ERROR: No postgres pod in $CLUSTER/$NS"
  exit 1
fi

echo "Applying 011_platform_settings.sql to $CLUSTER/$NS/$POD db=$DB user=$USER..."
"$KCTL" "$CLUSTER" exec -i -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f - < "$MIGRATION"

echo "Verify:"
"$KCTL" "$CLUSTER" exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "\\d platform_settings"

echo "OK: platform_settings applied on $CLUSTER/$NS"
