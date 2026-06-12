-- ERP settlement pipeline: commissions ledger, payout batches, merchant configs, sales assists
-- Idempotent — safe to re-run on dev/prod clones.

CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_vendor_id ON settlements ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_settlements_order_id ON settlements ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_settlements_scheduled_for ON settlements ((data->>'scheduledFor'));
CREATE INDEX IF NOT EXISTS idx_settlements_data_gin ON settlements USING GIN (data);

COMMENT ON TABLE settlements IS 'Canonical vendor commission/payout ledger (ERP commissions tab + vendor earnings)';

CREATE TABLE IF NOT EXISTS payout_batches (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_payout_batches_created_at ON payout_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_batches_data_gin ON payout_batches USING GIN (data);

COMMENT ON TABLE payout_batches IS 'Batch payout runs from processDueSettlements';

CREATE TABLE IF NOT EXISTS merchant_configs (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_configs_owner_entity_id ON merchant_configs ((data->>'ownerEntityId'));
CREATE INDEX IF NOT EXISTS idx_merchant_configs_data_gin ON merchant_configs USING GIN (data);

COMMENT ON TABLE merchant_configs IS 'Per-merchant commission structure, settlement rules, and wallet routing';

CREATE TABLE IF NOT EXISTS vendor_settlements (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_settlements_vendor_id ON vendor_settlements ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_order_id ON vendor_settlements ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_status ON vendor_settlements ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_vendor_settlements_data_gin ON vendor_settlements USING GIN (data);

COMMENT ON TABLE vendor_settlements IS 'Legacy processing log — canonical ledger is settlements';

CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements ((data->>'productId'));
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON stock_movements ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_stock_movements_data_gin ON stock_movements USING GIN (data);

COMMENT ON TABLE stock_movements IS 'ERP inventory audit trail (sales, restock, adjustments)';

CREATE TABLE IF NOT EXISTS erp_sales_assists (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_sales_assists_order_id ON erp_sales_assists ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_erp_sales_assists_referral_code ON erp_sales_assists ((data->>'referralCode'));
CREATE INDEX IF NOT EXISTS idx_erp_sales_assists_vendor_id ON erp_sales_assists ((data->>'vendorId'));
CREATE INDEX IF NOT EXISTS idx_erp_sales_assists_data_gin ON erp_sales_assists USING GIN (data);

COMMENT ON TABLE erp_sales_assists IS 'Referral-attributed sales assists for ERP analytics';
