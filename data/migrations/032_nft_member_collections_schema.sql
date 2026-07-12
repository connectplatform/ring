-- ============================================================================
-- 032_nft_member_collections_schema.sql
-- Member creator lane (on-platform Metaplex Core collections + mint index).
-- KEYS vendor-gate lane stays separate; this table is for lane M only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nft_member_collections (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_member_collections_creator
    ON nft_member_collections ((data->>'creatorUserId'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_nft_member_collections_mint_unique
    ON nft_member_collections ((data->>'collectionMint'))
    WHERE COALESCE(data->>'collectionMint', '') <> '';
CREATE INDEX IF NOT EXISTS idx_nft_member_collections_status
    ON nft_member_collections ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_nft_member_collections_symbol
    ON nft_member_collections ((data->>'symbol'));
CREATE INDEX IF NOT EXISTS idx_nft_member_collections_data_gin
    ON nft_member_collections USING GIN (data);

COMMENT ON TABLE nft_member_collections IS
  'On-platform member-created Metaplex Core collections (Exhibition lane M); KEYS gates remain lane K';

-- Listing lane indexes for dual-lane Exhibition feed
CREATE INDEX IF NOT EXISTS idx_nft_listings_lane
    ON nft_listings ((data->>'lane'));
CREATE INDEX IF NOT EXISTS idx_nft_listings_collection_id
    ON nft_listings ((data->>'collectionId'));

-- Backfill KEYS listings without an explicit lane
UPDATE nft_listings
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{lane}', '"keys"', true),
    updated_at = NOW()
WHERE COALESCE(data->>'lane', '') = ''
  AND data->>'chainFamily' = 'solana';
