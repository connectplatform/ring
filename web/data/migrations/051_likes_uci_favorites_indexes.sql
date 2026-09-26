-- ============================================================================
-- 051_likes_uci_favorites_indexes.sql
-- Dedupe likes, unique (userId,targetType,targetId), UCI action scan index,
-- user_favorites JSONB table + snake_case expression indexes.
-- Transactional (no CONCURRENTLY) — same style as 033.
-- ============================================================================

-- Likes: keep one row per (userId, targetType, targetId)
DELETE FROM likes a
USING likes b
WHERE a.ctid < b.ctid
  AND COALESCE(a.data->>'userId', '') = COALESCE(b.data->>'userId', '')
  AND COALESCE(a.data->>'targetType', '') = COALESCE(b.data->>'targetType', '')
  AND COALESCE(a.data->>'targetId', '') = COALESCE(b.data->>'targetId', '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_target
  ON likes ((data->>'userId'), (data->>'targetType'), (data->>'targetId'));

CREATE INDEX IF NOT EXISTS idx_likes_target
  ON likes ((data->>'targetType'), (data->>'targetId'));

-- Saved / not_interested scans filter userId+targetType+action without targetId.
CREATE INDEX IF NOT EXISTS idx_uci_user_type_action
  ON user_content_interactions ((data->>'userId'), (data->>'targetType'), (data->>'action'));

CREATE TABLE IF NOT EXISTS user_favorites (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_global_user_id
  ON user_favorites ((data->>'global_user_id'));

CREATE INDEX IF NOT EXISTS idx_user_favorites_type_id
  ON user_favorites ((data->>'favorite_type'), (data->>'favorite_id'));

CREATE INDEX IF NOT EXISTS idx_user_favorites_data_gin
  ON user_favorites USING GIN (data);

COMMENT ON TABLE user_favorites IS
  'Per-user favorites (product/entity/opportunity/content/user) — snake_case JSONB keys';

INSERT INTO schema_versions (version, description)
SELECT '051', 'Likes unique target index, UCI user/type/action, user_favorites JSONB'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '051'
);
