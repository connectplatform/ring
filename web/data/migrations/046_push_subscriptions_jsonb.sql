-- Push subscriptions JSONB schema (RFC Web Push dual-stack)
-- Separate from fcm_tokens — do not overload FCM token shape.
-- data JSONB: userId, endpoint, keys { p256dh, auth }, deviceFingerprint,
--   deviceInfo, platform, isActive, status ('active'|'stale'|'invalid'),
--   lastSeen, invalidatedAt.
-- One row per (userId, deviceFingerprint) OR unique endpoint.
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/046_push_subscriptions_jsonb.sql
-- Prod:   apply via db-migrator / kctl when Emperor authorizes Layer1-adjacent ops

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_device
    ON push_subscriptions ((data->>'userId'), (data->>'deviceFingerprint'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
    ON push_subscriptions ((data->>'endpoint'));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_data_user_id
    ON push_subscriptions ((data->>'userId'));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_data_is_active
    ON push_subscriptions (((data->>'isActive')::boolean));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_data_gin
    ON push_subscriptions USING GIN (data);

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE push_subscriptions IS 'RFC Web Push subscriptions — JSONB; dual-stack beside fcm_tokens';

INSERT INTO schema_versions (version, description)
SELECT '4.0.4-push-subscriptions-jsonb', 'push_subscriptions JSONB for RFC web-push dual-stack'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '4.0.4-push-subscriptions-jsonb'
);
