-- 014_user_roles_lowercase.sql
-- Idempotent: lowercase all user role strings in users.data JSONB.
-- Safe on databases already fully lowercase (updates 0 rows).
-- Apply: psql "$DATABASE_URL" -f data/migrations/014_user_roles_lowercase.sql

BEGIN;

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM users
  WHERE data->>'role' ~ '[A-Z]'
     OR data->'lastRoleUpgrade'->>'fromRole' ~ '[A-Z]'
     OR data->'lastRoleUpgrade'->>'toRole' ~ '[A-Z]'
     OR data->'pendingUpgradeRequest'->>'fromRole' ~ '[A-Z]'
     OR data->'pendingUpgradeRequest'->>'toRole' ~ '[A-Z]';
  RAISE NOTICE '014_user_roles_lowercase: rows with uppercase role fields = %', n;
END $$;

UPDATE users
SET data = jsonb_set(data, '{role}', to_jsonb(lower(btrim(data->>'role'))))
WHERE data->>'role' IS NOT NULL
  AND data->>'role' <> lower(btrim(data->>'role'));

UPDATE users
SET data = jsonb_set(
  data,
  '{lastRoleUpgrade,fromRole}',
  to_jsonb(lower(data->'lastRoleUpgrade'->>'fromRole'))
)
WHERE data->'lastRoleUpgrade'->>'fromRole' IS NOT NULL
  AND data->'lastRoleUpgrade'->>'fromRole' ~ '[A-Z]';

UPDATE users
SET data = jsonb_set(
  data,
  '{lastRoleUpgrade,toRole}',
  to_jsonb(lower(data->'lastRoleUpgrade'->>'toRole'))
)
WHERE data->'lastRoleUpgrade'->>'toRole' IS NOT NULL
  AND data->'lastRoleUpgrade'->>'toRole' ~ '[A-Z]';

UPDATE users
SET data = jsonb_set(
  data,
  '{pendingUpgradeRequest,fromRole}',
  to_jsonb(lower(data->'pendingUpgradeRequest'->>'fromRole'))
)
WHERE data->'pendingUpgradeRequest'->>'fromRole' IS NOT NULL
  AND data->'pendingUpgradeRequest'->>'fromRole' ~ '[A-Z]';

UPDATE users
SET data = jsonb_set(
  data,
  '{pendingUpgradeRequest,toRole}',
  to_jsonb(lower(data->'pendingUpgradeRequest'->>'toRole'))
)
WHERE data->'pendingUpgradeRequest'->>'toRole' IS NOT NULL
  AND data->'pendingUpgradeRequest'->>'toRole' ~ '[A-Z]';

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM users WHERE data->>'role' ~ '[A-Z]';
  IF n > 0 THEN
    RAISE EXCEPTION '014_user_roles_lowercase: % users still have uppercase data.role', n;
  END IF;
END $$;

COMMIT;
