-- ============================================================================
-- 034_store_promotions_jsonb.sql
-- Store promotions contract (JSONB on existing marketplace tables).
--
-- SSOT split:
--   • Per-vendor / per-product promo STATE → DB JSONB (this file)
--   • Allowed types / feature flags / defaults → ring-config.store.promotions
--
-- vendor_profiles.data.promotions (VendorStorePromotions):
--   {
--     "checkoutSpecialOfferEnabled": true,
--     "freeShipping": {
--       "mode": "off" | "always" | "conditional",
--       "minOrderAmount": 50,
--       "currency": "USD"
--     }
--   }
--
-- products / store_products.data.promotions (ProductPromotion[]):
--   [{
--     "id": "...",
--     "type": "bogo" | "percent_off" | "amount_off",
--     "enabled": true,
--     "buyQty": 2,
--     "getQty": 1,
--     "percentOff": 10,
--     "amountOff": 5,
--     "label": "Buy 2 get 1 free"
--   }]
--
-- No ALTER COLUMN required — marketplace tables already use data JSONB.
-- Indexes help dashboard / checkout filters without full table scans.
-- ============================================================================

-- Vendor free-shipping / special-offer flags
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_promo_offer
  ON vendor_profiles ((data->'promotions'->>'checkoutSpecialOfferEnabled'));

CREATE INDEX IF NOT EXISTS idx_vendor_profiles_promo_free_ship_mode
  ON vendor_profiles ((data->'promotions'->'freeShipping'->>'mode'));

-- Product promotions presence (expression index; GIN already covers deep queries)
CREATE INDEX IF NOT EXISTS idx_products_has_promotions
  ON products ((jsonb_array_length(COALESCE(data->'promotions', '[]'::jsonb))));

-- store_products alias collection (Ring platform primary product collection)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'store_products'
  ) THEN
    EXECUTE $i$
      CREATE INDEX IF NOT EXISTS idx_store_products_has_promotions
        ON store_products ((jsonb_array_length(COALESCE(data->'promotions', '[]'::jsonb))))
    $i$;
  END IF;
END $$;

COMMENT ON INDEX idx_vendor_profiles_promo_offer IS
  'Vendor checkout special-offer / free-shipping promotions (JSONB path)';
