-- 057 down: drop burn/mint kind column and registry row.

ALTER TABLE public.token_mint_events DROP CONSTRAINT IF EXISTS token_mint_events_kind_check;
DROP INDEX IF EXISTS idx_token_mint_events_kind;
ALTER TABLE public.token_mint_events DROP COLUMN IF EXISTS kind;
DELETE FROM schema_versions WHERE version = '057';
