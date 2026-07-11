-- ============================================================================
-- 029_nft_gates_schema.sql
-- Solana Metaplex Core NFT gate templates, stakes, and entitlement cache (MVP-A).
-- GateResolver must RPC-verify collection when collectionMint is configured.
-- Burn/unstake invalidates entitlement_cache (24h TTL policy).
-- ============================================================================

CREATE TABLE IF NOT EXISTS nft_gates (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_gates_slug ON nft_gates ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_nft_gates_active_asset ON nft_gates ((data->>'activeTemplateAsset'));
CREATE INDEX IF NOT EXISTS idx_nft_gates_data_gin ON nft_gates USING GIN (data);

COMMENT ON TABLE nft_gates IS 'NFT gate template editions / price history (Metaplex Core assets)';

CREATE TABLE IF NOT EXISTS nft_stakes (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_stakes_user_id ON nft_stakes ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_nft_stakes_asset ON nft_stakes ((data->>'asset'));
CREATE INDEX IF NOT EXISTS idx_nft_stakes_slug ON nft_stakes ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_nft_stakes_active ON nft_stakes ((data->>'unstakedAt'));
CREATE INDEX IF NOT EXISTS idx_nft_stakes_data_gin ON nft_stakes USING GIN (data);

COMMENT ON TABLE nft_stakes IS 'GateEscrow stake rows (userId, asset, slug, escrowPda); RPC-verify at gate check';

CREATE TABLE IF NOT EXISTS nft_entitlement_cache (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_entitlement_user ON nft_entitlement_cache ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_nft_entitlement_feature ON nft_entitlement_cache ((data->>'feature'));
CREATE INDEX IF NOT EXISTS idx_nft_entitlement_expires ON nft_entitlement_cache ((data->>'expiresAt'));
CREATE INDEX IF NOT EXISTS idx_nft_entitlement_data_gin ON nft_entitlement_cache USING GIN (data);

COMMENT ON TABLE nft_entitlement_cache IS 'Feature entitlement cache (24h TTL); invalidate on unstake/burn';

CREATE TABLE IF NOT EXISTS nft_ownership (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_ownership_user ON nft_ownership ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_nft_ownership_asset ON nft_ownership ((data->>'asset'));
CREATE INDEX IF NOT EXISTS idx_nft_ownership_slug ON nft_ownership ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_nft_ownership_data_gin ON nft_ownership USING GIN (data);

COMMENT ON TABLE nft_ownership IS 'Primary-sale ownership ledger for gate NFTs (asset, slug, purchase signature)';
