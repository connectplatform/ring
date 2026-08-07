-- ============================================================================
-- 026_product_custom_fields_schema.sql
-- Per-category custom product fields for vendors.
--
-- User Story: Allow vendors to add custom product fields per-category.
-- The product-category-custom-fields CRUD block is shown below the
-- vendor-store-product-category droplist on the vendor-store-product CRUD
-- page form. All known product custom fields and categories are shipped with
-- SQL migrations per preset.
--
-- Table: product_custom_fields
-- Columns:
--   id           — UUID primary key (generated client-side, e.g. crypto.randomUUID())
--   product_id   — FK to store_products.id (nullable until product is saved)
--   category     — The product category this field applies to (from ring-config storeCategories)
--   field_name   — Vendor-defined parameter name (e.g. "Soil Type", "Altitude")
--   field_value  — The value the vendor entered for this parameter
--   field_type   — Input type hint: 'text' | 'number' | 'date' | 'boolean' | 'select'
--   created_at   — ISO timestamp
--   updated_at   — ISO timestamp
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_custom_fields (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for looking up custom fields by product
CREATE INDEX IF NOT EXISTS idx_pcf_product_id ON product_custom_fields ((data->>'product_id'));

-- Index for looking up custom fields by category
CREATE INDEX IF NOT EXISTS idx_pcf_category ON product_custom_fields ((data->>'category'));

-- GIN index for JSONB queries on the data column
CREATE INDEX IF NOT EXISTS idx_pcf_data_gin ON product_custom_fields USING GIN (data);

COMMENT ON TABLE product_custom_fields IS 'Per-category custom product fields for vendor store products. Vendors can add custom parameters per product category. All known product custom fields and categories are shipped with SQL migrations per preset.';