-- Email CRM: tasks + API usage (JSONB row model).
-- Run after 009_email_crm_jsonb.sql.

CREATE TABLE IF NOT EXISTS email_tasks (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_tasks_thread_id ON email_tasks ((data->>'threadId'));
CREATE INDEX IF NOT EXISTS idx_email_tasks_status ON email_tasks ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_email_tasks_due_date ON email_tasks ((data->>'dueDate'));
CREATE INDEX IF NOT EXISTS idx_email_tasks_data_gin ON email_tasks USING GIN (data);
COMMENT ON TABLE email_tasks IS 'Email CRM follow-up and escalation tasks';

CREATE TABLE IF NOT EXISTS email_api_usage (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_api_usage_timestamp ON email_api_usage ((data->>'timestamp'));
CREATE INDEX IF NOT EXISTS idx_email_api_usage_operation ON email_api_usage ((data->>'operation'));
CREATE INDEX IF NOT EXISTS idx_email_api_usage_email_id ON email_api_usage ((data->>'emailId'));
CREATE INDEX IF NOT EXISTS idx_email_api_usage_data_gin ON email_api_usage USING GIN (data);
COMMENT ON TABLE email_api_usage IS 'Anthropic API usage records for email CRM cost tracking';
