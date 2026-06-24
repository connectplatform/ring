-- Drop legacy project_wallet_contacts after ring_contacts migration verified.
-- Migration: 021_drop_project_wallet_contacts.sql
-- Run only after migrate-wallet-contacts-to-ring-contacts.mjs report is clean.

DROP TABLE IF EXISTS project_wallet_contacts CASCADE;

INSERT INTO schema_versions (version, description)
SELECT '021', 'Drop legacy project_wallet_contacts (migrated to ring_contacts)'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '021'
);
