-- User device telemetry — last-known snapshot per user + device + domain (Ring Analytics)
-- Fraud forensics, usability (screen size, device label, coarse location).
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/023_user_device_telemetry_schema.sql
-- Prod:   cat data/migrations/023_user_device_telemetry_schema.sql | \
--           kctl k3s-3 -n ring-platform-org exec -i deploy/postgres -- \
--           psql -U ring_user -d ring_platform -v ON_ERROR_STOP=1

CREATE TABLE IF NOT EXISTS user_device_telemetry (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_device_telemetry_user_id
    ON user_device_telemetry ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_user_device_telemetry_device_id
    ON user_device_telemetry ((data->>'deviceId'));
CREATE INDEX IF NOT EXISTS idx_user_device_telemetry_domain
    ON user_device_telemetry ((data->>'domain'));
CREATE INDEX IF NOT EXISTS idx_user_device_telemetry_updated
    ON user_device_telemetry (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_device_telemetry_data_gin
    ON user_device_telemetry USING GIN (data);

COMMENT ON TABLE user_device_telemetry IS
    'Last-known device/session telemetry per user+device+domain — JSONB upsert (Ring Analytics)';

INSERT INTO schema_versions (version, description)
SELECT '023', 'User device telemetry: user_device_telemetry JSONB snapshots'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '023'
);
