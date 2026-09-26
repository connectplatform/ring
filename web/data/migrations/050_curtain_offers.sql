-- Curtain offers: per-user suppress prefs + analytics event indexes
-- Migration: 050_curtain_offers.sql

CREATE TABLE IF NOT EXISTS curtain_preferences (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curtain_preferences_updated_at
  ON curtain_preferences (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_curtain_preferences_data_gin
  ON curtain_preferences USING GIN (data);

COMMENT ON TABLE curtain_preferences IS
  'Per-user curtain offer prefs: not_for_me forever, not_today 24h, impression caps';

CREATE INDEX IF NOT EXISTS idx_analytics_events_curtain_type
  ON analytics_events ((data->>'eventType'))
  WHERE (data->>'eventType') LIKE 'curtain_%';

CREATE INDEX IF NOT EXISTS idx_analytics_events_curtain_offer
  ON analytics_events ((data->'payload'->>'offerId'))
  WHERE (data->>'eventType') LIKE 'curtain_%';

COMMENT ON TABLE analytics_events IS
  'Client app/navigation telemetry — JSONB; curtain_* events: curtain_shown, curtain_response, curtain_cta, curtain_suppress';

INSERT INTO schema_versions (version, description)
SELECT '050', 'Curtain offers: curtain_preferences + analytics curtain event indexes'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '050'
);
