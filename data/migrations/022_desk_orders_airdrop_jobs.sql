-- Phase 2: desk settlement, airdrop jobs, compliance audit
-- Migration: 022_desk_orders_airdrop_jobs.sql

CREATE TABLE IF NOT EXISTS desk_orders (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desk_orders_idempotency ON desk_orders ((data->>'idempotency_key'));
CREATE INDEX IF NOT EXISTS idx_desk_orders_user_id ON desk_orders ((data->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_desk_orders_status ON desk_orders ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_desk_orders_data_gin ON desk_orders USING GIN (data);

COMMENT ON TABLE desk_orders IS 'RingSales desk settlement state machine — JSONB';

CREATE TABLE IF NOT EXISTS airdrop_jobs (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_airdrop_jobs_idempotency ON airdrop_jobs ((data->>'idempotency_key'));
CREATE INDEX IF NOT EXISTS idx_airdrop_jobs_user_id ON airdrop_jobs ((data->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_airdrop_jobs_status ON airdrop_jobs ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_airdrop_jobs_data_gin ON airdrop_jobs USING GIN (data);

COMMENT ON TABLE airdrop_jobs IS 'Idempotent SPL airdrop jobs — JSONB';

CREATE TABLE IF NOT EXISTS compliance_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_address ON compliance_events ((data->>'address'));
CREATE INDEX IF NOT EXISTS idx_compliance_events_user_id ON compliance_events ((data->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_compliance_events_data_gin ON compliance_events USING GIN (data);

COMMENT ON TABLE compliance_events IS 'Compliance screening audit trail — JSONB';

INSERT INTO schema_versions (version, description)
SELECT '022', 'Phase 2: desk_orders, airdrop_jobs, compliance_events'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '022'
);
