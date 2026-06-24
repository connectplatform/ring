#!/usr/bin/env bash
# Apply Phase 2 desk/airdrop/compliance tables (022) to prod Postgres on k3s-or.
#
# Usage:
#   ./scripts/apply-desk-migrations-prod.sh
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-desk-migrations-prod.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/022_desk_orders_airdrop_jobs.sql"
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

echo "Applying 022_desk_orders_airdrop_jobs.sql to $CLUSTER/$NS/$POD db=$DB user=$USER..."
"$KCTL" "$CLUSTER" exec -i -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f - < "$MIGRATION"

echo "Verify tables:"
"$KCTL" "$CLUSTER" exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c \
  "SELECT version, description FROM schema_versions WHERE version = '022';"

"$KCTL" "$CLUSTER" exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c \
  "SELECT tablename FROM pg_tables WHERE tablename IN ('desk_orders','airdrop_jobs','compliance_events') ORDER BY 1;"

echo "OK: Phase 2 migration 022 applied on $CLUSTER/$NS"
