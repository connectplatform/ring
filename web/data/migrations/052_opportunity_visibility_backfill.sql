-- ============================================================================
-- 052_opportunity_visibility_backfill.sql
-- Null visibility hid rows once list filters required visibility IN (...).
-- Null isConfidential hid rows once the filter required isConfidential = false.
-- Idempotent. Chat-task tag cleanup stays in
-- scripts/backfill-opportunity-feed-honesty.mjs (not required for the filter).
-- ============================================================================

UPDATE opportunities
SET data = jsonb_set(data, '{visibility}', '"public"'::jsonb, true),
    updated_at = NOW()
WHERE COALESCE(btrim(data->>'visibility'), '') = '';

UPDATE opportunities
SET data = jsonb_set(data, '{isConfidential}', 'false'::jsonb, true),
    updated_at = NOW()
WHERE data->'isConfidential' IS NULL
   OR jsonb_typeof(data->'isConfidential') = 'null'
   OR data->>'isConfidential' = '';

INSERT INTO schema_versions (version, description)
SELECT '052', 'Backfill opportunity visibility public and isConfidential false'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '052'
);
