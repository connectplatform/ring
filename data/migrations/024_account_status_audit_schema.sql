-- Account status audit trail (admin suspend / reactivate)
--
-- Local:  psql "$DATABASE_URL" -f data/migrations/024_account_status_audit_schema.sql
-- Prod:   cat data/migrations/024_account_status_audit_schema.sql | \
--           kctl k3s-3 -n ring-platform-org exec -i deploy/postgres -- \
--           psql -U ring_user -d ring_platform -v ON_ERROR_STOP=1

CREATE TABLE IF NOT EXISTS account_status_audit (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_status_audit_user_id
    ON account_status_audit ((data->>'userId'));
CREATE INDEX IF NOT EXISTS idx_account_status_audit_action
    ON account_status_audit ((data->>'action'));
CREATE INDEX IF NOT EXISTS idx_account_status_audit_created
    ON account_status_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_status_audit_data_gin
    ON account_status_audit USING GIN (data);

COMMENT ON TABLE account_status_audit IS
    'Audit log for account suspend/reactivate actions (fraud desk)';

INSERT INTO schema_versions (version, description)
SELECT '024', 'Account status audit: account_status_audit JSONB'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '024'
);
