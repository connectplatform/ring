-- ============================================================================
-- PaymentConductor ledger — idempotent payment audit trail
-- Apply after platform DB baseline migrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_order_reference
    ON payment_transactions ((data->>'order_reference'));

CREATE INDEX IF NOT EXISTS idx_payment_transactions_purpose_status
    ON payment_transactions ((data->>'purpose'), (data->>'status'));

CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at
    ON payment_transactions (created_at DESC);

COMMENT ON TABLE payment_transactions IS 'Kingdom-wide payment ledger for PaymentConductor (all purposes/rails)';
