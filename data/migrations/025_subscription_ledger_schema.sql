-- Subscription Ledger — multi-provider membership subscription SSOT
-- Replaces ring_subscriptions (legacy RING credit-only) with a provider-agnostic
-- ledger supporting Stripe, WayForPay, RING credit-balance, on-chain RING token,
-- NFT gate, and PayPal (future).
--
-- SSOT for SubscriptionConductor + 5 ProcessConductor cron pipelines
-- (subscription-expiry-check, credit-balance-monthly, subscription-payment,
-- solana-batch-payment, nft-gate-expiry).
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/025_subscription_ledger_schema.sql
-- Prod:   cat data/migrations/025_subscription_ledger_schema.sql | \
--           kctl k3s-or -n ring-platform-org exec -i deploy/postgres -- \
--           psql -U ring_user -d ring_platform -v ON_ERROR_STOP=1

CREATE TABLE IF NOT EXISTS subscription_ledger (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Identity lookup
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_user_id
    ON subscription_ledger ((data->>'user_id'));

-- Provider filter (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_provider
    ON subscription_ledger ((data->>'provider'));

-- Status filter (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_status
    ON subscription_ledger ((data->>'status'));

-- Method filter (card / credit_balance / crypto / nft)
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_method
    ON subscription_ledger ((data->>'method'));

-- Cron: find due subscriptions (next_payment_due < now AND status = active)
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_due
    ON subscription_ledger ((data->>'next_payment_due'));

-- Cron: find credit-balance subscriptions due for payment
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_credit_due
    ON subscription_ledger (
        (data->>'provider'),
        (data->>'status'),
        (data->>'next_payment_due')
    ) WHERE (data->>'provider') = 'credit_balance';

-- Gateway-specific reference lookups
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_stripe_sub
    ON subscription_ledger ((data->>'stripe_subscription_id'))
    WHERE (data->>'stripe_subscription_id') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_ledger_wfp_rec
    ON subscription_ledger ((data->>'wayforpay_rec_token'))
    WHERE (data->>'wayforpay_rec_token') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_ledger_solana_tx
    ON subscription_ledger ((data->>'solana_tx_signature'))
    WHERE (data->>'solana_tx_signature') IS NOT NULL;

-- Composite index for admin stats (by_provider + by_status)
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_provider_status
    ON subscription_ledger ((data->>'provider'), (data->>'status'));

-- Recency index for admin listing
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_created
    ON subscription_ledger (created_at DESC);

-- GIN index for flexible JSONB queries
CREATE INDEX IF NOT EXISTS idx_subscription_ledger_data_gin
    ON subscription_ledger USING GIN (data);

COMMENT ON TABLE subscription_ledger IS
    'Multi-provider subscription SSOT (Stripe, WayForPay, RING credit, on-chain RING, NFT, PayPal). Drives SubscriptionConductor + 5 cron pipelines.';

INSERT INTO schema_versions (version, description)
SELECT '025', 'Subscription ledger: subscription_ledger JSONB SSOT for multi-provider subscriptions'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '025'
);
