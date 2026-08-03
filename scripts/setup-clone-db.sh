#!/usr/bin/env bash
# Create a Ring clone database and apply the flattened data/schema.sql SSOT.
#
# Usage:
#   ./scripts/setup-clone-db.sh --db-name ring_n9life_com --db-user n9life_user
#   ./scripts/setup-clone-db.sh --db-name ring_foo --database-url "$DATABASE_URL"
#   PGHOST=... PGUSER=ringdom_user PGPASSWORD=... ./scripts/setup-clone-db.sh --db-name ring_x --db-user ring_x_user --create-role
#
# Env:
#   PGHOST PGPORT PGUSER PGPASSWORD  — admin connection (can CREATE DATABASE / ROLE)
#   DATABASE_URL                     — optional; if set with --use-url, apply schema to that DB only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/data/schema.sql"
HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
ADMIN_USER="${PGUSER:-ring_user}"
ADMIN_PASS="${PGPASSWORD:-ring_password_2024}"
ADMIN_DB="${PGADMIN_DB:-postgres}"

DB_NAME=""
DB_USER=""
DB_PASS=""
CREATE_ROLE=0
USE_URL=0
DATABASE_URL_ARG=""

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-name) DB_NAME="$2"; shift 2 ;;
    --db-user) DB_USER="$2"; shift 2 ;;
    --db-password) DB_PASS="$2"; shift 2 ;;
    --database-url) DATABASE_URL_ARG="$2"; USE_URL=1; shift 2 ;;
    --create-role) CREATE_ROLE=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1"; usage 1 ;;
  esac
done

if [[ ! -f "$SCHEMA" ]]; then
  echo "Missing $SCHEMA"
  exit 1
fi

export PGPASSWORD="$ADMIN_PASS"

if [[ "$USE_URL" -eq 1 ]]; then
  URL="${DATABASE_URL_ARG:-${DATABASE_URL:-}}"
  if [[ -z "$URL" ]]; then
    echo "--database-url / DATABASE_URL required"
    exit 1
  fi
  echo "==> Applying schema.sql to DATABASE_URL"
  psql "$URL" -v ON_ERROR_STOP=1 -f "$SCHEMA"
  echo "DONE"
  exit 0
fi

if [[ -z "$DB_NAME" ]]; then
  echo "--db-name is required (or use --database-url)"
  usage 1
fi

DB_USER="${DB_USER:-ring_user}"
if [[ -z "$DB_PASS" && "$CREATE_ROLE" -eq 1 ]]; then
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
fi

echo "==> Ensure role $DB_USER (create=$CREATE_ROLE)"
if [[ "$CREATE_ROLE" -eq 1 ]]; then
  psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
SQL
fi

echo "==> Create database $DB_NAME owner $DB_USER"
psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
-- Keep existing DB if present; create when missing
SQL
EXISTS="$(psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -Atc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")"
if [[ "$EXISTS" != "1" ]]; then
  psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
else
  echo "  (database already exists — applying schema idempotently)"
fi

echo "==> Extensions (admin)"
psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
SQL

echo "==> Apply flattened schema.sql"
psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$SCHEMA"

echo "==> Grants to $DB_USER"
psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;
GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
SQL

TABLES="$(psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$DB_NAME" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'")"
echo "==> Tables: $TABLES"
if [[ "$CREATE_ROLE" -eq 1 ]]; then
  echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${HOST}:${PORT}/${DB_NAME}"
fi
echo "DONE"
