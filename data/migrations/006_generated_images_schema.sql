-- Generated images ledger — ImageConductor audit trail (xAI / Google Imagen)
-- Idempotent — safe to re-run on dev/prod clones.

CREATE TABLE IF NOT EXISTS generated_images (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_images_actor_id ON generated_images ((data->>'actorId'));
CREATE INDEX IF NOT EXISTS idx_generated_images_provider ON generated_images ((data->>'provider'));
CREATE INDEX IF NOT EXISTS idx_generated_images_purpose ON generated_images ((data->>'purpose'));
CREATE INDEX IF NOT EXISTS idx_generated_images_ref_code ON generated_images ((data->>'refCode'));
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_data_gin ON generated_images USING GIN (data);

COMMENT ON TABLE generated_images IS 'AI-generated images stored in ring-filebase via ImageConductor';
