-- ============================================================================
-- Email CRM Schema Migration for Ringdom (ring-ringdom-org)
-- ============================================================================
-- Version: 1.1.0
-- Database: ring_ringdom_org
-- Purpose: AI-assisted email management with CRM and task funnel for info@ringdom.org
-- Reference: Email Automation Specialist + Prompt Injection Prevention Specialist
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- EMAIL CONTACTS TABLE (CRM for external inquirers)
-- Named email_contacts to avoid conflict with user_favorites (favorite_type='user')
-- which stores Ring Platform user contact lists
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    company VARCHAR(255),
    type VARCHAR(50) DEFAULT 'lead', -- lead, customer, partner, vendor, spam
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    ring_user_id VARCHAR(255) REFERENCES global_users(id), -- Link to Ring Platform user if they have an account
    first_contact TIMESTAMPTZ DEFAULT NOW(),
    last_contact TIMESTAMPTZ DEFAULT NOW(),
    total_interactions INTEGER DEFAULT 1,
    sentiment_history JSONB DEFAULT '[]'::jsonb, -- Track sentiment over time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_type ON email_contacts(type);
CREATE INDEX IF NOT EXISTS idx_email_contacts_ring_user_id ON email_contacts(ring_user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_last_contact ON email_contacts(last_contact DESC);
CREATE INDEX IF NOT EXISTS idx_email_contacts_company ON email_contacts(company);
CREATE INDEX IF NOT EXISTS idx_email_contacts_tags_gin ON email_contacts USING GIN (tags);

COMMENT ON TABLE email_contacts IS 'CRM registry for external email inquirers (separate from user contact lists)';
COMMENT ON COLUMN email_contacts.ring_user_id IS 'Link to global_users if this contact has a Ring Platform account';
COMMENT ON COLUMN email_contacts.sentiment_history IS 'Array of {sentiment, timestamp} for trend analysis';

-- ============================================================================
-- EMAIL THREADS TABLE (Conversation grouping)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_thread_id VARCHAR(500), -- Message-ID or References chain identifier
    subject VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'new', -- new, ongoing, waiting, resolved, spam
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    assigned_to VARCHAR(255), -- User ID or 'ai' for auto-handled
    contact_id UUID REFERENCES email_contacts(id) ON DELETE SET NULL,
    intent VARCHAR(100), -- Primary intent classification
    intent_confidence DECIMAL(3,2),
    auto_handled BOOLEAN DEFAULT false, -- True if fully automated response
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    first_response_at TIMESTAMPTZ, -- For response time metrics
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_priority ON email_threads(priority);
CREATE INDEX IF NOT EXISTS idx_email_threads_contact_id ON email_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_intent ON email_threads(intent);
CREATE INDEX IF NOT EXISTS idx_email_threads_assigned_to ON email_threads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_created_at ON email_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_external_thread_id ON email_threads(external_thread_id);

COMMENT ON TABLE email_threads IS 'Email conversation threads grouped by References/In-Reply-To headers';
COMMENT ON COLUMN email_threads.external_thread_id IS 'Message-ID chain for thread reconstruction';
COMMENT ON COLUMN email_threads.auto_handled IS 'True if AI responded without human review';

-- ============================================================================
-- EMAIL MESSAGES TABLE (Individual emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    message_id VARCHAR(500) UNIQUE, -- RFC 5322 Message-ID header
    in_reply_to VARCHAR(500), -- References parent message
    references_chain TEXT[], -- Full References header array
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_email VARCHAR(255) NOT NULL,
    cc_emails TEXT[],
    subject VARCHAR(500),
    body_text TEXT,
    body_html TEXT,
    sentiment VARCHAR(50), -- positive, neutral, negative, frustrated
    sentiment_score DECIMAL(3,2), -- 0.00 to 1.00
    intent VARCHAR(100), -- Classification result
    intent_confidence DECIMAL(3,2),
    is_inbound BOOLEAN DEFAULT true,
    raw_headers JSONB,
    attachments JSONB DEFAULT '[]'::jsonb, -- [{filename, mime_type, size, storage_path}]
    security_flags JSONB DEFAULT '{}'::jsonb, -- Prompt injection detection results
    processed_at TIMESTAMPTZ, -- When AI processing completed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from_email ON email_messages(from_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_sentiment ON email_messages(sentiment);
CREATE INDEX IF NOT EXISTS idx_email_messages_intent ON email_messages(intent);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_inbound ON email_messages(is_inbound);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);

-- Full-text search for email content
CREATE INDEX IF NOT EXISTS idx_email_messages_search ON email_messages 
USING GIN (to_tsvector('english', 
    COALESCE(subject, '') || ' ' || 
    COALESCE(body_text, '')
));

COMMENT ON TABLE email_messages IS 'Individual email messages with AI analysis metadata';
COMMENT ON COLUMN email_messages.security_flags IS 'Prompt injection detection: {risk_score, flagged_patterns, blocked}';

-- ============================================================================
-- EMAIL DRAFTS TABLE (AI-generated responses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    draft_content TEXT NOT NULL,
    draft_html TEXT, -- HTML formatted version
    confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    model_used VARCHAR(50), -- claude-haiku-4-5, claude-sonnet-4-5, etc.
    model_reasoning TEXT, -- Why this response was generated
    tools_used JSONB DEFAULT '[]'::jsonb, -- Which Claude tools were invoked
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, edited, sent, rejected, auto_sent
    reviewed_by VARCHAR(255), -- User ID of reviewer
    reviewed_at TIMESTAMPTZ,
    edit_notes TEXT, -- Changes made during review
    sent_at TIMESTAMPTZ,
    sent_message_id VARCHAR(500), -- Message-ID of sent email
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_message_id ON email_drafts(message_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_thread_id ON email_drafts(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_confidence ON email_drafts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);

COMMENT ON TABLE email_drafts IS 'AI-generated email response drafts with review workflow';
COMMENT ON COLUMN email_drafts.tools_used IS 'Array of Claude tool invocations: [{name, input, result}]';

-- ============================================================================
-- EMAIL TASKS TABLE (Follow-ups and escalations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL, -- follow_up, escalation, action_required, review
    due_date TIMESTAMPTZ,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, completed, cancelled, overdue
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    auto_generated BOOLEAN DEFAULT true, -- Created by AI vs manual
    trigger_reason TEXT, -- Why task was created
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(255),
    completion_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tasks_thread_id ON email_tasks(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_tasks_status ON email_tasks(status);
CREATE INDEX IF NOT EXISTS idx_email_tasks_task_type ON email_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_email_tasks_assigned_to ON email_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_email_tasks_due_date ON email_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_email_tasks_priority ON email_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_email_tasks_created_at ON email_tasks(created_at DESC);

COMMENT ON TABLE email_tasks IS 'Email follow-up tasks and escalations';
COMMENT ON COLUMN email_tasks.trigger_reason IS 'AI reasoning for auto-generated tasks';

-- ============================================================================
-- EMAIL SECURITY EVENTS TABLE (Prompt injection tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- prompt_injection_blocked, output_validation_failed, suspicious_pattern
    risk_score DECIMAL(3,2), -- 0.00 to 1.00
    technique VARCHAR(100), -- delimiter_confusion, instruction_override, etc.
    flagged_patterns JSONB DEFAULT '[]'::jsonb,
    raw_content_hash VARCHAR(64), -- SHA-256 of original content for audit
    action_taken VARCHAR(50), -- blocked, escalated, logged
    reviewed BOOLEAN DEFAULT false,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    false_positive BOOLEAN, -- For model improvement
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_security_events_message_id ON email_security_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_security_events_event_type ON email_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_security_events_risk_score ON email_security_events(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_email_security_events_created_at ON email_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_security_events_reviewed ON email_security_events(reviewed);

COMMENT ON TABLE email_security_events IS 'Prompt injection detection and security audit trail';
COMMENT ON COLUMN email_security_events.false_positive IS 'Mark if legitimate email was flagged (improves classifier)';

-- ============================================================================
-- EMAIL ANALYTICS TABLE (Daily aggregations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    emails_received INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    auto_responses INTEGER DEFAULT 0, -- Fully automated
    draft_reviews INTEGER DEFAULT 0, -- Required human review
    escalations INTEGER DEFAULT 0,
    avg_response_time_minutes INTEGER,
    first_contact_resolution_rate DECIMAL(5,2), -- Percentage
    sentiment_distribution JSONB DEFAULT '{}'::jsonb, -- {positive: X, neutral: Y, negative: Z}
    intent_distribution JSONB DEFAULT '{}'::jsonb, -- {intent: count}
    security_blocks INTEGER DEFAULT 0, -- Prompt injection blocks
    api_costs JSONB DEFAULT '{}'::jsonb, -- {haiku: X, sonnet: Y, opus: Z, total: T}
    cache_hit_rate DECIMAL(5,2), -- Prompt caching effectiveness
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_analytics_date ON email_analytics(date);

COMMENT ON TABLE email_analytics IS 'Daily email processing analytics and cost tracking';

-- ============================================================================
-- EMAIL KNOWLEDGE BASE TABLE (RAG content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'faq', -- faq, documentation, response_template, product_info
    category VARCHAR(100),
    tags JSONB DEFAULT '[]'::jsonb,
    embedding VECTOR(1536), -- OpenAI ada-002 or Claude embedding dimension
    usage_count INTEGER DEFAULT 0, -- How often used in responses
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS idx_email_knowledge_base_content_type ON email_knowledge_base(content_type);
CREATE INDEX IF NOT EXISTS idx_email_knowledge_base_category ON email_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_email_knowledge_base_is_active ON email_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_email_knowledge_base_tags_gin ON email_knowledge_base USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_email_knowledge_base_embedding ON email_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE email_knowledge_base IS 'RAG knowledge base for AI response generation';
COMMENT ON COLUMN email_knowledge_base.embedding IS 'Vector embedding for semantic search (1536-dim for OpenAI compatibility)';

-- ============================================================================
-- API USAGE TRACKING TABLE (Cost monitoring per Anthropic API Specialist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255), -- Anthropic request ID
    email_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,
    model VARCHAR(50) NOT NULL, -- claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-5
    operation VARCHAR(50) NOT NULL, -- classification, sentiment, response_generation, batch_analytics
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) NOT NULL, -- Precise cost tracking
    latency_ms INTEGER, -- API response time
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_api_usage_model ON email_api_usage(model);
CREATE INDEX IF NOT EXISTS idx_email_api_usage_operation ON email_api_usage(operation);
CREATE INDEX IF NOT EXISTS idx_email_api_usage_email_id ON email_api_usage(email_id);
CREATE INDEX IF NOT EXISTS idx_email_api_usage_created_at ON email_api_usage(created_at DESC);

COMMENT ON TABLE email_api_usage IS 'Anthropic API usage tracking for cost optimization';
COMMENT ON COLUMN email_api_usage.cost_usd IS 'Calculated cost based on token pricing per model';

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Trigger to update email_contacts.last_contact on new message
CREATE OR REPLACE FUNCTION update_email_contact_last_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE email_contacts
    SET last_contact = NOW(),
        total_interactions = total_interactions + 1,
        updated_at = NOW()
    WHERE email = NEW.from_email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_on_message ON email_messages;
CREATE TRIGGER trigger_update_contact_on_message
AFTER INSERT ON email_messages
FOR EACH ROW
WHEN (NEW.is_inbound = true)
EXECUTE FUNCTION update_email_contact_last_contact();

-- Trigger to update thread last_message_at
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE email_threads
    SET last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON email_messages;
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON email_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_last_message();

-- Trigger to mark tasks as overdue
CREATE OR REPLACE FUNCTION mark_overdue_tasks()
RETURNS void AS $$
BEGIN
    UPDATE email_tasks
    SET status = 'overdue',
        updated_at = NOW()
    WHERE status IN ('open', 'in_progress')
    AND due_date < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update triggers for updated_at columns
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY['email_contacts', 'email_threads', 'email_tasks', 
                           'email_analytics', 'email_knowledge_base'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- VIEWS FOR DASHBOARD
-- ============================================================================

-- Active threads view
CREATE OR REPLACE VIEW v_active_email_threads AS
SELECT 
    t.id,
    t.subject,
    t.status,
    t.priority,
    t.intent,
    t.assigned_to,
    t.created_at,
    t.last_message_at,
    c.email as contact_email,
    c.name as contact_name,
    c.company as contact_company,
    c.type as contact_type,
    (SELECT COUNT(*) FROM email_messages m WHERE m.thread_id = t.id) as message_count,
    (SELECT COUNT(*) FROM email_drafts d WHERE d.thread_id = t.id AND d.status = 'pending') as pending_drafts
FROM email_threads t
LEFT JOIN email_contacts c ON t.contact_id = c.id
WHERE t.status NOT IN ('resolved', 'spam')
ORDER BY 
    CASE t.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'low' THEN 4 
    END,
    t.last_message_at DESC;

-- Pending drafts view
CREATE OR REPLACE VIEW v_pending_email_drafts AS
SELECT 
    d.id,
    d.draft_content,
    d.confidence_score,
    d.model_used,
    d.created_at,
    t.subject as thread_subject,
    t.priority as thread_priority,
    m.from_email as original_from,
    m.from_name as original_from_name,
    m.body_text as original_body,
    c.name as contact_name,
    c.company as contact_company
FROM email_drafts d
JOIN email_threads t ON d.thread_id = t.id
JOIN email_messages m ON d.message_id = m.id
LEFT JOIN email_contacts c ON t.contact_id = c.id
WHERE d.status = 'pending'
ORDER BY d.confidence_score DESC, d.created_at ASC;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

INSERT INTO schema_versions (version, description) 
VALUES ('1.1.0', 'Email CRM schema: threads, messages, drafts, contacts, tasks, security events, analytics, knowledge base, API usage')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ring_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ring_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ring_user;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 'Email CRM Schema v1.1.0 - Installation Complete' as message,
       (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'email_%') as email_tables_created;
