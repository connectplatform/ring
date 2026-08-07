-- 036_project_order_deployments.sql
-- Order Lab deployment docs — env config + edge status for paid project orders.

CREATE TABLE IF NOT EXISTS project_deployments (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_deployments_order_id
  ON project_deployments ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS idx_project_deployments_edge
  ON project_deployments ((data->>'edge'));
CREATE INDEX IF NOT EXISTS idx_project_deployments_updated_at
  ON project_deployments (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_deployments_data_gin
  ON project_deployments USING GIN (data);

COMMENT ON TABLE project_deployments IS
  'Order Lab per-order deploy config (edge, encrypted env, k8s names) for ring clone builds';
