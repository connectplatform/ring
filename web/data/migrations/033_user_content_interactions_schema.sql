-- ============================================================================
-- 033_user_content_interactions_schema.sql
-- Generic user×content interaction ledger (save / not_interested / contact_intent)
-- for opportunity feed matcher weights. Likes remain in `likes` collection.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_content_interactions (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uci_user ON user_content_interactions ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_uci_target ON user_content_interactions ((data->>'targetType'), (data->>'targetId'));
CREATE INDEX IF NOT EXISTS idx_uci_action ON user_content_interactions ((data->>'action'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_uci_unique_action
    ON user_content_interactions ((data->>'userId'), (data->>'targetType'), (data->>'targetId'), (data->>'action'));
CREATE INDEX IF NOT EXISTS idx_uci_data_gin ON user_content_interactions USING GIN (data);

COMMENT ON TABLE user_content_interactions IS
  'Opportunity feed save/not_interested/contact_intent rows with matcher signal weights';
