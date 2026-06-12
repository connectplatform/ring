#!/usr/bin/env bash
# Bootstrap ephemeral Postgres for CI smoke runs: base schema + incremental migrations.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL="${DATABASE_URL:?Set DATABASE_URL (postgresql://user:pass@host:5432/db)}"

echo "▶ Applying base schema"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/data/schema.sql"

echo "▶ Applying migrations"
shopt -s nullglob
for migration in "$ROOT"/data/migrations/*.sql; do
  echo "  → $(basename "$migration")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "✅ Postgres bootstrap complete"
