-- Platform-wide event log (matcher runs, auto-approvals, training pipeline)
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_events_time_ms ON events (((data->>'timeMs')::bigint));
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN (data);

COMMENT ON TABLE events IS 'Append-only platform event log — JSONB; matcher runs, auto-approvals, training examples';
