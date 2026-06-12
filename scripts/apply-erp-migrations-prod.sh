#!/usr/bin/env bash
# Apply refcodes (005) + ERP settlement (007) to prod Postgres on k3s-or (Oregon).
#
# Usage:
#   kctl k3s-or …  (prefix kubectl invocations, or export KUBECONFIG from ~/.kube/clusters/k3s-or.yaml)
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-erp-migrations-prod.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION_005="$ROOT/data/migrations/005_refcodes_schema.sql"
MIGRATION_007="$ROOT/data/migrations/007_settlements_schema.sql"
NS="${K8S_NAMESPACE:?Set K8S_NAMESPACE}"
DB="${POSTGRES_DB:?Set POSTGRES_DB}"
USER="${POSTGRES_USER:?Set POSTGRES_USER}"

echo "Finding postgres pod in namespace $NS..."
POD="$(kubectl get pods -n "$NS" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$POD" ]]; then
  POD="$(kubectl get pods -n "$NS" -o name 2>/dev/null | rg 'postgres' | head -1 | sed 's|pod/||')"
fi
if [[ -z "$POD" ]]; then
  echo "ERROR: No postgres pod in $NS"
  exit 1
fi

echo "Applying 005 + 007 to $NS/$POD db=$DB..."
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -f - < "$MIGRATION_005"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -f - < "$MIGRATION_007"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "\\dt *settlement*"

echo "OK: ERP migrations applied"
