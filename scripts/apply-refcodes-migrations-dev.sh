#!/usr/bin/env bash
# Apply refcodes tables to Ring Platform dev Postgres.
#
# Canonical dev database: ring_platform (see .env.local DATABASE_URL and
# infrastructure/postgres/init/README.md — NOT ring_file_registry or clone DBs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/005_refcodes_schema.sql"
DB_NAME="${POSTGRES_DB:-ring_platform}"

apply_psql() {
  local url="$1"
  echo "Applying 005_refcodes_schema.sql → $url"
  psql "$url" -f "$MIGRATION"
  psql "$url" -c "\\dt ref*"
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  apply_psql "$DATABASE_URL"
  echo "OK: refcodes tables applied"
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null | rg -q '^ring-postgres-dev$'; then
  if ! docker exec ring-postgres-dev psql -U ring_user -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | rg -q 1; then
    echo "ERROR: database '${DB_NAME}' not found on ring-postgres-dev."
    echo "Run init from repo root: docker compose -f docker-compose.dev.yml up -d postgres"
    echo "Or: infrastructure/postgres/init/00-create-ring-platform-db.sh (see init/README.md)"
    exit 1
  fi
  echo "Applying via ring-postgres-dev / ${DB_NAME}..."
  docker exec -i ring-postgres-dev psql -U ring_user -d "$DB_NAME" < "$MIGRATION"
  docker exec ring-postgres-dev psql -U ring_user -d "$DB_NAME" -c "\\dt ref*"
  echo "OK: refcodes tables on ring-postgres-dev:${DB_NAME}"
  exit 0
fi

echo "Set DATABASE_URL (ring_platform) or start ring-postgres-dev"
exit 1
