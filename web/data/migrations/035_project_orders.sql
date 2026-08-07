-- 035_project_orders.sql
-- Calculator / CRM custom orders (ringization jobs) — separate from store SKU orders.

CREATE TABLE IF NOT EXISTS project_orders (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_orders_user_id
  ON project_orders ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_project_orders_payment_status
  ON project_orders ((data->>'paymentStatus'));
CREATE INDEX IF NOT EXISTS idx_project_orders_work_status
  ON project_orders ((data->>'workStatus'));
CREATE INDEX IF NOT EXISTS idx_project_orders_integrator_id
  ON project_orders ((data->>'integratorId'));
CREATE INDEX IF NOT EXISTS idx_project_orders_opportunity_id
  ON project_orders ((data->>'opportunityId'));
CREATE INDEX IF NOT EXISTS idx_project_orders_created_at
  ON project_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_orders_data_gin
  ON project_orders USING GIN (data);

COMMENT ON TABLE project_orders IS
  'CRM custom orders from Ring Project Calculator — payment + work lifecycle (not store SKUs)';
