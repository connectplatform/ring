-- FCM tokens JSONB schema migration (idempotent)
-- Aligns fcm_tokens with FCM specialist: one row per (userId, deviceFingerprint).
-- Requires: update_updated_at_column() (created below if missing).
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/016_fcm_jsonb_schema.sql
-- Prod:   kctl k3s-or exec -n ring-platform-org deploy/postgres -- \
--           psql -U ring_user -d ring_platform -f - < data/migrations/016_fcm_jsonb_schema.sql

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FCM PUSH NOTIFICATION TOKENS (JSONB — Ring adapter pattern)
-- ============================================================================
-- data JSONB: userId, token, deviceFingerprint (required), deviceInfo, platform,
--   browser, userAgent, isActive, lastSeen, status ('active'|'stale'|'invalid'), invalidatedAt.
-- One row per (userId, deviceFingerprint); no UNIQUE on token (FCM rotation safe).
DROP TABLE IF EXISTS fcm_tokens CASCADE;

CREATE TABLE fcm_tokens (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_tokens_user_device
    ON fcm_tokens ((data->>'userId'), (data->>'deviceFingerprint'));

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_data_user_id ON fcm_tokens ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_data_is_active ON fcm_tokens (((data->>'isActive')::boolean));
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_created_at ON fcm_tokens (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_data_gin ON fcm_tokens USING GIN (data);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active_user ON fcm_tokens ((data->>'userId'))
    WHERE (data->>'status') = 'active';

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_seen_active
    ON fcm_tokens ((data->>'lastSeen'))
    WHERE (data->>'status') = 'active';

DROP TRIGGER IF EXISTS update_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER update_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE fcm_tokens IS 'FCM push tokens — JSONB data; one row per (userId, deviceFingerprint)';

INSERT INTO schema_versions (version, description)
SELECT '4.0.3-fcm-jsonb', 'fcm_tokens JSONB schema with userId+deviceFingerprint unique index'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '4.0.3-fcm-jsonb'
);
