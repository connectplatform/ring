-- Ring contacts — per-project address book (Ring users)
-- Migration: 020_ring_contacts_schema.sql

CREATE TABLE IF NOT EXISTS ring_contacts (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ring_contacts_owner_project ON ring_contacts (
    (data->>'owner_user_id'),
    (data->>'project_slug')
);
CREATE INDEX IF NOT EXISTS idx_ring_contacts_contact_user ON ring_contacts ((data->>'contact_user_id'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_ring_contacts_owner_project_contact_unique ON ring_contacts (
    (data->>'owner_user_id'),
    (data->>'project_slug'),
    (data->>'contact_user_id')
);
CREATE INDEX IF NOT EXISTS idx_ring_contacts_favorite ON ring_contacts (
    (data->>'owner_user_id'),
    (data->>'project_slug'),
    (data->>'is_favorite')
);
CREATE INDEX IF NOT EXISTS idx_ring_contacts_data_gin ON ring_contacts USING GIN (data);

COMMENT ON TABLE ring_contacts IS 'Per-project Ring user address book — JSONB; scoped by owner_user_id + project_slug';

INSERT INTO schema_versions (version, description)
SELECT '020', 'Ring contacts: ring_contacts collection for user-linked address book'
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '020'
);
