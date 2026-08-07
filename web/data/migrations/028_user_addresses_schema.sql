-- ============================================================================
-- 028_user_addresses_schema.sql
-- Saved shipping addresses for authenticated store checkout.
-- JSONB document model matching AddressService (features/store/services/address-service.ts).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_addresses (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_user_addresses_is_default ON user_addresses ((data->>'isDefault'));
CREATE INDEX IF NOT EXISTS idx_user_addresses_created_at ON user_addresses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_addresses_data_gin ON user_addresses USING GIN (data);

COMMENT ON TABLE user_addresses IS 'Saved shipping addresses for store checkout (AddressService SSOT)';
