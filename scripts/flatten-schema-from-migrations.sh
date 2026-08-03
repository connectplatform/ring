#!/usr/bin/env bash
# Flatten data/migrations/*.sql into data/schema.sql (fresh-install SSOT).
# Requires local Postgres with CREATE DATABASE privilege (default ring_user).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${PGHOST:-localhost}"
USER="${PGUSER:-ring_user}"
PASS="${PGPASSWORD:-ring_password_2024}"
ADMIN_DB="${PGADMIN_DB:-postgres}"
FLAT_DB="${FLAT_DB:-ring_schema_flatten}"
export PGPASSWORD="$PASS"

psql_admin() { psql -h "$HOST" -U "$USER" -d "$ADMIN_DB" "$@"; }
psql_flat() { psql -h "$HOST" -U "$USER" -d "$FLAT_DB" "$@"; }

echo "==> Recreate $FLAT_DB"
psql_admin -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$FLAT_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $FLAT_DB;
CREATE DATABASE $FLAT_DB OWNER $USER;
SQL

echo "==> Extensions"
psql_flat -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql_flat -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
psql_flat -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS postgis;' || {
  echo "WARN: postgis failed — continuing (GIS features may need superuser)"
}

BACKUP="$ROOT/data/schema.sql.bak-pre-flatten-$(date +%Y%m%d%H%M%S)"
cp "$ROOT/data/schema.sql" "$BACKUP"
echo "==> Backup $BACKUP"

# Prefer prior schema as base if present; else empty + migrations only
if [[ -f "$BACKUP" ]]; then
  echo "==> Apply prior schema.sql"
  psql_flat -v ON_ERROR_STOP=0 -f "$BACKUP" >/tmp/flatten-schema.log 2>&1 || true
fi

echo "==> Apply migrations (skip legacy 001_email_crm_schema.sql)"
OK=0
FAIL=0
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  if [[ "$base" == "001_email_crm_schema.sql" ]]; then
    echo "  SKIP $base"
    continue
  fi
  if psql_flat -v ON_ERROR_STOP=1 -f "$f" >/tmp/flatten-mig-one.log 2>&1; then
    OK=$((OK + 1))
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL $base"
    grep -E '^ERROR' /tmp/flatten-mig-one.log | tail -3 || true
  fi
done < <(find "$ROOT/data/migrations" -maxdepth 1 -name '*.sql' -print0 | sort -z)

echo "==> Migrations ok=$OK fail=$FAIL"
TABLES="$(psql_flat -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'")"
echo "==> Tables: $TABLES"

echo "==> Dump DDL + seeds"
pg_dump -h "$HOST" -U "$USER" -d "$FLAT_DB" \
  --schema=public --schema-only --no-owner --no-privileges \
  --exclude-table=spatial_ref_sys \
  >/tmp/ring-schema-ddl.sql

pg_dump -h "$HOST" -U "$USER" -d "$FLAT_DB" \
  --schema=public --data-only --no-owner --no-privileges --column-inserts \
  -t currencies -t countries -t schema_versions -t store_settings -t news_categories \
  >/tmp/ring-schema-seeds.sql

python3 "$ROOT/scripts/assemble-flattened-schema.py"

echo "==> Verify fresh apply on empty DB"
VERIFY_DB="${FLAT_DB}_verify"
psql_admin -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$VERIFY_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $VERIFY_DB;
CREATE DATABASE $VERIFY_DB OWNER $USER;
SQL
psql -h "$HOST" -U "$USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' \
  -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;' \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;' >/dev/null 2>&1 || true
# Strip extension lines from schema for re-apply (already created) — apply full file
if ! psql -h "$HOST" -U "$USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 \
  -f "$ROOT/data/schema.sql" >/tmp/flatten-verify.log 2>&1; then
  echo "VERIFY FAILED — see /tmp/flatten-verify.log"
  grep -E '^ERROR' /tmp/flatten-verify.log | head -20
  exit 1
fi
VTABLES="$(psql -h "$HOST" -U "$USER" -d "$VERIFY_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'")"
echo "==> Verify tables=$VTABLES"
echo "DONE: $ROOT/data/schema.sql"
