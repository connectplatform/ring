-- Generated videos ledger — VideoConductor audit trail (xAI Grok Imagine Video)
-- Idempotent — safe to re-run on dev/prod clones.

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

COMMENT ON TABLE generated_videos IS 'AI-generated videos stored in ring-filebase via VideoConductor';
