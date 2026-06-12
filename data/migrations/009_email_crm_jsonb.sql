-- Email CRM tables — JSONB row model (platform convention).
-- Supersedes 001_email_crm_schema.sql, which used column tables with a
-- greenfood-only global_users FK and never applied cleanly on base platform.
-- Drops the legacy column-model tables only when empty.

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['email_threads','email_contacts','email_messages','email_drafts','email_tasks'] LOOP
        IF to_regclass(t) IS NOT NULL THEN
            -- legacy column-model table: drop only if empty and not already JSONB-model
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = t AND column_name = 'data'
            ) THEN
                EXECUTE format('SELECT 1 FROM %I LIMIT 1', t);
                IF NOT FOUND THEN
                    EXECUTE format('DROP TABLE %I CASCADE', t);
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS email_contacts (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON email_contacts ((data->>'email'));
CREATE INDEX IF NOT EXISTS idx_email_contacts_type ON email_contacts ((data->>'type'));
CREATE INDEX IF NOT EXISTS idx_email_contacts_data_gin ON email_contacts USING GIN (data);
COMMENT ON TABLE email_contacts IS 'Email CRM contacts (leads, customers, partners)';

CREATE TABLE IF NOT EXISTS email_threads (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_email_threads_from_email ON email_threads ((data->>'fromEmail'));
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads ((data->>'lastMessageAt'));
CREATE INDEX IF NOT EXISTS idx_email_threads_data_gin ON email_threads USING GIN (data);
COMMENT ON TABLE email_threads IS 'Email CRM conversation threads';

CREATE TABLE IF NOT EXISTS email_messages (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages ((data->>'threadId'));
CREATE INDEX IF NOT EXISTS idx_email_messages_data_gin ON email_messages USING GIN (data);
COMMENT ON TABLE email_messages IS 'Individual email messages within CRM threads';

CREATE TABLE IF NOT EXISTS email_drafts (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_drafts_thread_id ON email_drafts ((data->>'threadId'));
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts ((data->>'status'));
COMMENT ON TABLE email_drafts IS 'AI/manual reply drafts pending review';
