#!/usr/bin/env bash
# Apply generated_images migration locally (ring-platform.org).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="$ROOT/data/migrations/006_generated_images_schema.sql"
DATABASE_URL="${DATABASE_URL:-postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform}"

if command -v psql >/dev/null 2>&1; then
  echo "Applying 006_generated_images_schema.sql to $DATABASE_URL..."
  psql "$DATABASE_URL" -f "$MIGRATION"
  echo "Verify:"
  psql "$DATABASE_URL" -c "\\d generated_images"
elif docker ps --format '{{.Names}}' 2>/dev/null | rg -q '^ring-postgres-dev$'; then
  echo "Applying 006 via docker exec ring-postgres-dev..."
  docker exec -i ring-postgres-dev psql -U ring_user -d ring_platform -f - < "$MIGRATION"
  docker exec ring-postgres-dev psql -U ring_user -d ring_platform -c "\\d generated_images"
else
  echo "ERROR: psql not found and ring-postgres-dev container not running."
  exit 1
fi
