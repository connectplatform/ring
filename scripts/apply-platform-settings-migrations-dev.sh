#!/usr/bin/env bash
# Apply platform_settings table (011) to Ring Platform dev Postgres (ring_platform).
#
# Canonical dev: ring-postgres-dev via docker-compose.dev.yml at repo root, or DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/011_platform_settings.sql"
DB_NAME="${POSTGRES_DB:-ring_platform}"

apply_psql() {
  local url="$1"
  echo "Applying 011_platform_settings.sql → $url"
  psql "$url" -v ON_ERROR_STOP=1 -f "$MIGRATION"
  psql "$url" -c "\\d platform_settings"
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  apply_psql "$DATABASE_URL"
  echo "OK: platform_settings applied (DATABASE_URL)"
  exit 0
fi

if docker ps --format '{{.Names}}' 2>/dev/null | rg -q '^ring-postgres-dev$'; then
  echo "Applying via ring-postgres-dev / ${DB_NAME}..."
  docker exec -i ring-postgres-dev psql -U ring_user -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$MIGRATION"
  docker exec ring-postgres-dev psql -U ring_user -d "$DB_NAME" -c "\\d platform_settings"
  echo "OK: platform_settings on ring-postgres-dev:${DB_NAME}"
  exit 0
fi

echo "Start dev Postgres from repo root:"
echo "  docker compose -f docker-compose.dev.yml up -d postgres"
echo "Or set DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform"
exit 1
