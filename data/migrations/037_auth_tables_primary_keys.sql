-- ============================================================================
-- 037_auth_tables_primary_keys.sql
-- Align users/accounts/sessions/verification_tokens with schema.sql PRIMARY KEY
-- and unique OAuth account link index. Safe when ids are already unique.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_pkey'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_pkey'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- verification_tokens already has verification_tokens_pkey on some envs

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_account_unique
  ON accounts ((data->>'provider'), (data->>'providerAccountId'));

INSERT INTO schema_versions (version, description, applied_by)
SELECT
  '037',
  'Auth tables PRIMARY KEY + unique provider/providerAccountId on accounts',
  CURRENT_USER
WHERE NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = '037');
