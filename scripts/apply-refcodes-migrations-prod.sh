#!/usr/bin/env bash
# Apply refcodes migration to prod Postgres inside k8s (ring-platform-org, ring-ringdom-org, ring-connect-software).
#
# Usage examples:
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-refcodes-migrations-prod.sh
#   K8S_NAMESPACE=ring-ringdom-org POSTGRES_DB=ring_ringdom_org POSTGRES_USER=ringdom_user ./scripts/apply-refcodes-migrations-prod.sh
#   K8S_NAMESPACE=ring-connect-software POSTGRES_DB=ring_connect_software POSTGRES_USER=ring_user ./scripts/apply-refcodes-migrations-prod.sh
#
# Requires: kctl k3s-or (Oregon prod). Do not use k3s-1 (Ashburn) for ring-platform.org.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/005_refcodes_schema.sql"
NS="${K8S_NAMESPACE:?Set K8S_NAMESPACE (e.g. ring-platform-org)}"
DB="${POSTGRES_DB:?Set POSTGRES_DB}"
USER="${POSTGRES_USER:?Set POSTGRES_USER}"

echo "Finding postgres pod in namespace $NS..."
POD="$(kubectl get pods -n "$NS" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$POD" ]]; then
  POD="$(kubectl get pods -n "$NS" -o name 2>/dev/null | rg 'postgres' | head -1 | sed 's|pod/||')"
fi
if [[ -z "$POD" ]]; then
  echo "ERROR: No postgres pod in $NS. Run from jump host with valid kubeconfig."
  exit 1
fi

echo "Applying 005_refcodes_schema.sql to $NS/$POD db=$DB user=$USER..."
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -f - < "$MIGRATION"

echo "Verify:"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "\\dt ref*"
