-- Phase 2: desk settlement, credit-add jobs, compliance audit
-- Migration: 022_desk_orders_credit_add_jobs.sql

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

COMMENT ON TABLE desk_orders IS 'CoinDesk settlement state machine — JSONB';

CREATE TABLE IF NOT EXISTS credit_add_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_add_events_idempotency ON credit_add_events ((data->>'idempotency_key'));
CREATE INDEX IF NOT EXISTS idx_credit_add_events_user_id ON credit_add_events ((data->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_credit_add_events_status ON credit_add_events ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_credit_add_events_data_gin ON credit_add_events USING GIN (data);

COMMENT ON TABLE credit_add_events IS 'Idempotent credit-add events — JSONB';

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
SELECT '022', 'Phase 2: desk_orders, credit_add_events, compliance_events'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '022'
);
