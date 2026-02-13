#!/bin/bash
# Run PostgreSQL migrations inside Docker container
# Usage: ./scripts/run-migration.sh <migration-file.sql>

CONTAINER_NAME="ring-postgres-dev"
DB_USER="ring_user"
DB_NAME="ring_greenfood_live"

if [ -z "$1" ]; then
  echo "❌ Error: No migration file specified"
  echo "Usage: ./scripts/run-migration.sh <migration-file.sql>"
  exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🔥 Running migration: $MIGRATION_FILE"
echo "Container: $CONTAINER_NAME"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
else
  echo ""
  echo "❌ Migration failed!"
  exit 1
fi

