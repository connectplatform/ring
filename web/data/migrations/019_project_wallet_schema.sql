-- Per-project wallet tables (contacts, wallets, transactions)
-- Migration: 019_project_wallet_schema.sql
-- JSONB row model: id + data + timestamps (matches PostgreSQLAdapter)

CREATE TABLE IF NOT EXISTS project_wallet_contacts (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwc_user_project ON project_wallet_contacts ((data->>'global_user_id'), (data->>'project_slug'));
CREATE INDEX IF NOT EXISTS idx_pwc_address ON project_wallet_contacts ((data->>'global_user_id'), (data->>'project_slug'), (data->>'address'));
CREATE INDEX IF NOT EXISTS idx_pwc_favorite ON project_wallet_contacts ((data->>'global_user_id'), (data->>'project_slug'), (data->>'is_favorite'));
CREATE INDEX IF NOT EXISTS idx_pwc_last_used ON project_wallet_contacts ((data->>'last_used') DESC);
CREATE INDEX IF NOT EXISTS idx_pwc_data_gin ON project_wallet_contacts USING GIN (data);

CREATE TABLE IF NOT EXISTS project_wallets (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pw_user_project ON project_wallets ((data->>'global_user_id'), (data->>'project_slug'));
CREATE INDEX IF NOT EXISTS idx_pw_data_gin ON project_wallets USING GIN (data);

CREATE TABLE IF NOT EXISTS project_wallet_transactions (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwt_user_project ON project_wallet_transactions ((data->>'global_user_id'), (data->>'project_slug'));
CREATE INDEX IF NOT EXISTS idx_pwt_timestamp ON project_wallet_transactions ((data->>'timestamp') DESC);
CREATE INDEX IF NOT EXISTS idx_pwt_data_gin ON project_wallet_transactions USING GIN (data);

COMMENT ON TABLE project_wallet_contacts IS 'Per-project wallet address book — JSONB; scoped by global_user_id + project_slug';
COMMENT ON TABLE project_wallets IS 'Per-project wallet accounts — JSONB; scoped by global_user_id + project_slug';
COMMENT ON TABLE project_wallet_transactions IS 'Per-project wallet transfer history — JSONB';

INSERT INTO schema_versions (version, description)
SELECT '019', 'Per-project wallet: project_wallet_contacts, project_wallets, project_wallet_transactions'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '019'
);
