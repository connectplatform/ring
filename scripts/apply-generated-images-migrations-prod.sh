#!/usr/bin/env bash
# Apply generated_images migration to prod Postgres inside k8s.
#
# Usage:
#   K8S_NAMESPACE=ring-platform-org POSTGRES_DB=ring_platform POSTGRES_USER=ring_user \
#     ./scripts/apply-generated-images-migrations-prod.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/006_generated_images_schema.sql"
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

echo "Applying 006_generated_images_schema.sql to $NS/$POD db=$DB user=$USER..."
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -f - < "$MIGRATION"

echo "Verify:"
kubectl exec -n "$NS" "$POD" -- psql -U "$USER" -d "$DB" -c "\\d generated_images"
