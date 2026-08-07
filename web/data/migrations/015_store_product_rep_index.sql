-- Store product JSONB indexes: rep username + Main Store moderation
-- Products remain JSONB-only (store_products.data); rep is data->>'rep'

CREATE INDEX IF NOT EXISTS idx_store_products_rep ON store_products ((data->>'rep'));
CREATE INDEX IF NOT EXISTS idx_store_products_approval_status ON store_products ((data->>'approvalStatus'));
CREATE INDEX IF NOT EXISTS idx_store_products_list_stores ON store_products USING GIN ((data->'listStores'));

COMMENT ON INDEX idx_store_products_rep IS 'Lookup products by assigned representative username';
