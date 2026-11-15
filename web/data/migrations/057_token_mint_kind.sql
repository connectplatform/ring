-- 057: Audit-trail kind for superadmin native-token treasury operations.
-- Mints and burns share token_mint_events; kind distinguishes them.
-- Default 'mint' keeps pre-057 rows valid.

ALTER TABLE public.token_mint_events
  ADD COLUMN IF NOT EXISTS kind character varying(16) NOT NULL DEFAULT 'mint';

ALTER TABLE public.token_mint_events
  DROP CONSTRAINT IF EXISTS token_mint_events_kind_check;

ALTER TABLE public.token_mint_events
  ADD CONSTRAINT token_mint_events_kind_check CHECK (kind IN ('mint', 'burn'));

CREATE INDEX IF NOT EXISTS idx_token_mint_events_kind
  ON public.token_mint_events (kind, created_at DESC);

INSERT INTO schema_versions (version, description, applied_by)
SELECT '057',
       'token_mint_events.kind: mint|burn for superadmin treasury audit',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '057'
);
