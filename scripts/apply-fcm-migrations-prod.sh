#!/usr/bin/env bash
# Apply FCM JSONB migration to prod Postgres (k3s-or / ring-platform-org).
#
# Usage:
#   kctl k3s-or bash -c 'K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-fcm-migrations-prod.sh'
# Or with kubeconfig already on k3s-or:
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user ./scripts/apply-fcm-migrations-prod.sh
#
# Drops and recreates fcm_tokens — acceptable for push token registry.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/016_fcm_jsonb_schema.sql"
NS="${K8S_NAMESPACE:?Set K8S_NAMESPACE (e.g. ring-platform-org)}"
DB="${POSTGRES_DB:?Set POSTGRES_DB}"
USER="${POSTGRES_USER:?Set POSTGRES_USER}"

echo "Finding postgres pod in namespace $NS..."
POD="$(kubectl get pods -n "$NS" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$POD" ]]; then
  POD="$(kubectl get pods -n "$NS" -o name 2>/dev/null | rg 'postgres' | head -1 | sed 's|pod/||')"
fi
if [[ -z "$POD" ]]; then
  echo "ERROR: No postgres pod in $NS. Run with kctl k3s-or and valid kubeconfig."
  exit 1
fi

echo "Applying 016_fcm_jsonb_schema.sql to $NS/$POD db=$DB user=$USER..."
kubectl exec -i -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f - < "$MIGRATION"

echo "Verify fcm_tokens:"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "\\d fcm_tokens"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "SELECT version, description FROM schema_versions WHERE version LIKE '%fcm%' ORDER BY version;"
