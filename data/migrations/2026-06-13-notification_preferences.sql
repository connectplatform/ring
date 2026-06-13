-- notification_preferences (Ring Platform v4 JSONB collection)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_updated_at ON notification_preferences (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_data_gin ON notification_preferences USING GIN (data);

COMMENT ON TABLE notification_preferences IS 'Per-user notification channel/type preferences';
