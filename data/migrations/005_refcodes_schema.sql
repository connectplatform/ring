-- Referral codes + reward ledger (refcodes module)
-- Idempotent — safe to re-run on dev/prod clones.

CREATE TABLE IF NOT EXISTS refcodes (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refcodes_owner_user_id ON refcodes ((data->>'ownerUserId'));
CREATE INDEX IF NOT EXISTS idx_refcodes_wallet_address ON refcodes ((data->>'walletAddress'));
CREATE INDEX IF NOT EXISTS idx_refcodes_code ON refcodes ((data->>'code'));
CREATE INDEX IF NOT EXISTS idx_refcodes_data_gin ON refcodes USING GIN (data);

COMMENT ON TABLE refcodes IS 'Shareable referral codes — one per user wallet';

CREATE TABLE IF NOT EXISTS referral_rewards (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_order_reference ON referral_rewards ((data->>'orderReference'));
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_user_id ON referral_rewards ((data->>'referrerUserId'));
CREATE INDEX IF NOT EXISTS idx_referral_rewards_data_gin ON referral_rewards USING GIN (data);

COMMENT ON TABLE referral_rewards IS 'Referral reward payouts — pending approval, minted on-chain';
