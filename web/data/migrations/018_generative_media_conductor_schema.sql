-- Generative media conductor ledgers — ImageConductor + VideoConductor
-- Idempotent — safe on dev/prod clones.
--
-- Code SSOT:
--   lib/images/conductor/image-conductor.ts  → generated_images
--   lib/video/conductor/video-conductor.ts → generated_videos
--   MCP: ring-image-create, ring-video-create
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/018_generative_media_conductor_schema.sql
-- Prod:   cat data/migrations/018_generative_media_conductor_schema.sql | \
--           kctl k3s-or -n ring-platform-org exec -i deploy/postgres -- \
--           psql -U ring_user -d ring_platform -v ON_ERROR_STOP=1

-- ============================================================================
-- generated_images (migration 006 — ensure present on clones that skipped it)
-- ============================================================================
-- JSONB data fields: actorId, provider, model, prompt, enhancedPrompt,
--   aspectRatio, resolution, purpose, refCode, url, fileId, size, createdAt

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

-- ============================================================================
-- generated_videos (migration 007 + VideoConductor v2 fields)
-- ============================================================================
-- JSONB data fields: actorId, provider, model, qualityMode, resolution, prompt,
--   requestId, remasterFromRequestId, remasterFromVideoUrl, generationKind,
--   firstFrameUrl, thumbnailUrl, clipId, pipelineRequestId, purpose, refCode,
--   url, fileId, size, duration, createdAt

CREATE TABLE IF NOT EXISTS generated_videos (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_videos_actor_id ON generated_videos ((data->>'actorId'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_provider ON generated_videos ((data->>'provider'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_purpose ON generated_videos ((data->>'purpose'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_ref_code ON generated_videos ((data->>'refCode'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_clip_id ON generated_videos ((data->>'clipId'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_pipeline_request_id ON generated_videos ((data->>'pipelineRequestId'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_created_at ON generated_videos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_videos_data_gin ON generated_videos USING GIN (data);

-- VideoConductor v2 query paths (draft/production/remaster, xAI request_id audit)
CREATE INDEX IF NOT EXISTS idx_generated_videos_quality_mode ON generated_videos ((data->>'qualityMode'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_request_id ON generated_videos ((data->>'requestId'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_generation_kind ON generated_videos ((data->>'generationKind'));
CREATE INDEX IF NOT EXISTS idx_generated_videos_remaster_from_request_id ON generated_videos ((data->>'remasterFromRequestId'));

COMMENT ON TABLE generated_videos IS 'AI-generated videos stored in ring-filebase via VideoConductor';

INSERT INTO schema_versions (version, description)
SELECT '018', 'Generative media: generated_images + generated_videos (ImageConductor / VideoConductor)'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '018'
);
