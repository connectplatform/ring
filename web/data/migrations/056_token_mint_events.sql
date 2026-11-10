-- Audit log for superadmin native-token treasury mints.
-- One row per mint attempt. Written as pending before send, then confirmed or failed.
-- tx_signature is unique when present; pending rows may have a null signature.

CREATE TABLE IF NOT EXISTS public.token_mint_events (
    id character varying(255) DEFAULT (gen_random_uuid())::text NOT NULL,
    project_id character varying(255) NOT NULL,
    superadmin_user_id character varying(255) NOT NULL,
    superadmin_email character varying(255),
    amount numeric(40, 18) NOT NULL,
    amount_raw numeric(78, 0) NOT NULL,
    mint_address character varying(255) NOT NULL,
    destination character varying(255) NOT NULL,
    tx_signature character varying(255),
    note text,
    cluster character varying(64),
    status character varying(32) DEFAULT 'pending' NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT token_mint_events_pkey PRIMARY KEY (id),
    CONSTRAINT token_mint_events_tx_signature_key UNIQUE (tx_signature),
    CONSTRAINT token_mint_events_status_check CHECK (status IN ('pending', 'confirmed', 'failed'))
);

COMMENT ON TABLE public.token_mint_events IS
  'Superadmin native-token mint audit. project_id names the clone that triggered the mint so two projects sharing one mint can be joined.';
COMMENT ON COLUMN public.token_mint_events.amount IS 'UI amount in mint decimals (not raw base units).';
COMMENT ON COLUMN public.token_mint_events.amount_raw IS 'Integer base units from the mint instruction.';
COMMENT ON COLUMN public.token_mint_events.destination IS 'Token account that received the minted supply (usually the treasury ATA).';
COMMENT ON COLUMN public.token_mint_events.tx_signature IS 'Solana transaction signature. Unique when set; null while pending.';
COMMENT ON COLUMN public.token_mint_events.cluster IS 'Solana cluster or network (e.g. devnet, mainnet-beta).';

CREATE INDEX IF NOT EXISTS idx_token_mint_events_created_at
  ON public.token_mint_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_mint_events_mint
  ON public.token_mint_events (mint_address);

CREATE INDEX IF NOT EXISTS idx_token_mint_events_project_id
  ON public.token_mint_events (project_id);

INSERT INTO schema_versions (version, description, applied_by)
SELECT '056',
       'token_mint_events: audit log for superadmin native-token treasury mints',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '056'
);
