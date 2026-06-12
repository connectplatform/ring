-- Platform-wide admin settings (AI/LLM, branding, etc.)
-- Idempotent — safe to re-run on dev/prod clones.

CREATE TABLE IF NOT EXISTS platform_settings (
    id VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    secrets JSONB NOT NULL DEFAULT '{}',
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_data_gin ON platform_settings USING GIN (data);

COMMENT ON TABLE platform_settings IS 'SUPERADMIN platform settings by namespace id (ai, branding, …)';
COMMENT ON COLUMN platform_settings.id IS 'Settings namespace key';
COMMENT ON COLUMN platform_settings.data IS 'Non-secret configuration JSON';
COMMENT ON COLUMN platform_settings.secrets IS 'API keys and secrets (masked in admin GET)';
