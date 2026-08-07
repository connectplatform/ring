-- Inventory levels + reservations (inventory-sync service)
-- Previously the service targeted camelCase collections with no tables — pipeline was dead.
-- Idempotent — safe to re-run.
-- NOTE: Merged into ring-platform.org/data/schema.sql (v4.0.1+). Keep for incremental apply on existing DBs.

CREATE TABLE IF NOT EXISTS inventory_levels (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_product_id ON inventory_levels ((data->>'productId'));
CREATE INDEX IF NOT EXISTS idx_inventory_levels_store_id ON inventory_levels ((data->>'storeId'));
CREATE INDEX IF NOT EXISTS idx_inventory_levels_data_gin ON inventory_levels USING GIN (data);

COMMENT ON TABLE inventory_levels IS 'Per product+store inventory levels (id = productId_storeId)';

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id ON inventory_reservations ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON inventory_reservations ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires_at ON inventory_reservations ((data->>'expiresAt'));
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_data_gin ON inventory_reservations USING GIN (data);

COMMENT ON TABLE inventory_reservations IS 'Order inventory holds with TTL — released by cron cleanup-reservations';
