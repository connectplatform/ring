-- ============================================================================
-- 030_nft_gate_purchases_schema.sql
-- Pay-then-mint purchase ledger + RING refund recovery (idempotent by paySignature).
-- ============================================================================

CREATE TABLE IF NOT EXISTS nft_gate_purchases (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_gate_purchases_user_id ON nft_gate_purchases ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_nft_gate_purchases_pay_sig ON nft_gate_purchases ((data->>'paySignature'));
CREATE INDEX IF NOT EXISTS idx_nft_gate_purchases_status ON nft_gate_purchases ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_nft_gate_purchases_data_gin ON nft_gate_purchases USING GIN (data);

COMMENT ON TABLE nft_gate_purchases IS 'NFT gate primary-sale pay→mint ledger; refund recovery keyed by paySignature';
