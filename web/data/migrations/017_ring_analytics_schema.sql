-- Ring Analytics — JSONB telemetry tables (web vitals, app events, client errors)
-- Migration: 017_ring_analytics_schema.sql

CREATE TABLE IF NOT EXISTS analytics_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events ((data->>'sessionId'));
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events ((data->>'eventType'));
CREATE INDEX IF NOT EXISTS idx_analytics_events_data_gin ON analytics_events USING GIN (data);

CREATE TABLE IF NOT EXISTS web_vitals (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at ON web_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_session_id ON web_vitals ((data->>'sessionId'));
CREATE INDEX IF NOT EXISTS idx_web_vitals_data_gin ON web_vitals USING GIN (data);

CREATE TABLE IF NOT EXISTS analytics_errors (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_errors_created_at ON analytics_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_errors_severity ON analytics_errors ((data->>'severity'));
CREATE INDEX IF NOT EXISTS idx_analytics_errors_data_gin ON analytics_errors USING GIN (data);

COMMENT ON TABLE analytics_events IS 'Client app/navigation telemetry — JSONB; one row per event';
COMMENT ON TABLE web_vitals IS 'Core Web Vitals batches — JSONB';
COMMENT ON TABLE analytics_errors IS 'Client-side error logs — JSONB';

INSERT INTO schema_versions (version, description)
SELECT '017', 'Ring analytics: analytics_events, web_vitals, analytics_errors'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '017'
);
