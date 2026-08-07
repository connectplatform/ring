-- ============================================================================
-- 031_nft_exhibition_market_schema.sql
-- Solana-first NFT Exhibition Marketplace persistence.
-- Fixed-price Metaplex Core gate listings, RING settlement sales ledger,
-- and verified collection aggregate cache.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nft_listings (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_listings_status ON nft_listings ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_chain_family ON nft_listings ((data->>'chainFamily'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_collection ON nft_listings ((data->>'collection'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_slug ON nft_listings ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_seller_user_id ON nft_listings ((data->>'sellerUserId'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_seller_username ON nft_listings ((lower(data->>'sellerUsername')));
CREATE INDEX IF NOT EXISTS idx_nft_listings_created_at_json ON nft_listings ((data->>'createdAt'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_listed_at_json ON nft_listings ((data->>'listedAt'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_price_raw_numeric
    ON nft_listings (((NULLIF(data->>'priceRaw', ''))::numeric));
CREATE INDEX IF NOT EXISTS idx_nft_listings_listing_pda ON nft_listings ((data->>'listingPda'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_search_text
    ON nft_listings USING GIN (to_tsvector('english', COALESCE(data->>'searchText', '')));
CREATE INDEX IF NOT EXISTS idx_nft_listings_data_gin ON nft_listings USING GIN (data);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nft_listings_active_asset_unique
    ON nft_listings ((data->>'asset'))
    WHERE data->>'status' = 'active' AND data->>'chainFamily' = 'solana';

COMMENT ON TABLE nft_listings IS 'Solana Metaplex Core NFT Exhibition marketplace listings; legacy EVM rows stay chainFamily=evm and excluded from new feed';

CREATE TABLE IF NOT EXISTS nft_market_sales (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nft_market_sales_idempotency
    ON nft_market_sales ((data->>'idempotencyKey'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_listing_id ON nft_market_sales ((data->>'listingId'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_buyer_user_id ON nft_market_sales ((data->>'buyerUserId'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_seller_user_id ON nft_market_sales ((data->>'sellerUserId'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_asset ON nft_market_sales ((data->>'asset'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_status ON nft_market_sales ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_tx_hash ON nft_market_sales ((data->>'txHash'));
CREATE INDEX IF NOT EXISTS idx_nft_market_sales_data_gin ON nft_market_sales USING GIN (data);

COMMENT ON TABLE nft_market_sales IS 'Idempotent NFT marketplace sale/reconciliation ledger for atomic RING settlement';

CREATE TABLE IF NOT EXISTS nft_market_collections (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_market_collections_collection
    ON nft_market_collections ((data->>'collection'));
CREATE INDEX IF NOT EXISTS idx_nft_market_collections_slug ON nft_market_collections ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_nft_market_collections_symbol ON nft_market_collections ((data->>'symbol'));
CREATE INDEX IF NOT EXISTS idx_nft_market_collections_active
    ON nft_market_collections (((COALESCE(data->>'activeListings', '0'))::integer));
CREATE INDEX IF NOT EXISTS idx_nft_market_collections_data_gin
    ON nft_market_collections USING GIN (data);

COMMENT ON TABLE nft_market_collections IS 'Verified NFT collection metadata and marketplace aggregate cache';

-- Deterministic quarantine for older EVM-shaped rows. New Solana feed filters
-- chainFamily='solana', so ERC token IDs are never reinterpreted as Core assets.
UPDATE nft_listings
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{chainFamily}', '"evm"', true),
    updated_at = NOW()
WHERE data ? 'item'
  AND COALESCE(data->>'chainFamily', '') = '';
