#!/usr/bin/env bash
# Apply ERP settlement tables (007) + refcodes (005) + inventory (008) to Ring Platform dev Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION_005="$ROOT/data/migrations/005_refcodes_schema.sql"
MIGRATION_007="$ROOT/data/migrations/007_settlements_schema.sql"
MIGRATION_008="$ROOT/data/migrations/008_inventory_schema.sql"
DB_NAME="${POSTGRES_DB:-ring_platform}"

apply_psql() {
  local url="$1"
  echo "Applying 005_refcodes_schema.sql → $url"
  psql "$url" -f "$MIGRATION_005"
  echo "Applying 007_settlements_schema.sql → $url"
  psql "$url" -f "$MIGRATION_007"
  echo "Applying 008_inventory_schema.sql → $url"
  psql "$url" -f "$MIGRATION_008"
  psql "$url" -c "\\dt *settlement*"
  psql "$url" -c "\\dt inventory*"
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  apply_psql "$DATABASE_URL"
  echo "OK: ERP + refcodes + inventory tables applied"
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null | rg -q '^ring-postgres-dev$'; then
  echo "Applying via ring-postgres-dev / ${DB_NAME}..."
  docker exec -i ring-postgres-dev psql -U ring_user -d "$DB_NAME" < "$MIGRATION_005"
  docker exec -i ring-postgres-dev psql -U ring_user -d "$DB_NAME" < "$MIGRATION_007"
  docker exec -i ring-postgres-dev psql -U ring_user -d "$DB_NAME" < "$MIGRATION_008"
  docker exec ring-postgres-dev psql -U ring_user -d "$DB_NAME" -c "\\dt *settlement*"
  docker exec ring-postgres-dev psql -U ring_user -d "$DB_NAME" -c "\\dt inventory*"
  echo "OK: ERP migrations on ring-postgres-dev:${DB_NAME}"
  exit 0
fi

echo "Set DATABASE_URL (ring_platform) or start ring-postgres-dev"
exit 1
