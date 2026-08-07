-- Process runs ledger — ProcessConductor audit trail for cron / background pipelines
-- Idempotent — safe to re-run on dev/prod clones.

CREATE TABLE IF NOT EXISTS process_runs (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_runs_pipeline_id ON process_runs ((data->>'pipelineId'));
CREATE INDEX IF NOT EXISTS idx_process_runs_status ON process_runs ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_process_runs_created_at ON process_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_runs_data_gin ON process_runs USING GIN (data);

COMMENT ON TABLE process_runs IS 'Background pipeline run history (ProcessConductor)';
