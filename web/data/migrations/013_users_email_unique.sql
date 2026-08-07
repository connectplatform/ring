-- User email uniqueness guard (case-insensitive on JSONB email)
-- Prerequisite: run scripts/dedupe-users-by-email.cts --apply before applying this migration.

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_lower
  ON users (lower(data->>'email'))
  WHERE (data->>'email') IS NOT NULL AND btrim(data->>'email') <> '';

COMMENT ON INDEX idx_users_email_unique_lower IS 'One platform user per normalized email; Google sub lives in accounts.providerAccountId';
