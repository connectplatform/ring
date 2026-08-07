-- Entity moderation: user reports + matcher moderation event queue (JSONB collections)

CREATE TABLE IF NOT EXISTS entity_reports (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_reports_entity_id ON entity_reports ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_entity_reports_reporter ON entity_reports ((data->>'reporterUserId'));
CREATE INDEX IF NOT EXISTS idx_entity_reports_status ON entity_reports ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_entity_reports_created_at ON entity_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_reports_data_gin ON entity_reports USING GIN (data);

COMMENT ON TABLE entity_reports IS 'User-submitted entity moderation reports';
COMMENT ON COLUMN entity_reports.data IS 'entityId, reporterUserId, category, reason, status, createdAt';

CREATE TABLE IF NOT EXISTS matcher_moderation_events (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matcher_moderation_entity_id ON matcher_moderation_events ((data->>'entityId'));
CREATE INDEX IF NOT EXISTS idx_matcher_moderation_type ON matcher_moderation_events ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_matcher_moderation_created_at ON matcher_moderation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matcher_moderation_data_gin ON matcher_moderation_events USING GIN (data);

COMMENT ON TABLE matcher_moderation_events IS 'Matcher/admin moderation queue fed by entity report and block actions';

-- Entity discovery filter helper index (Ring-backend clones only)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'entities'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_entities_moderation_status ON entities ((data->>'moderationStatus'));
  END IF;
END $$;
