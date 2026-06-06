-- ============================================================================
-- News Kingdom Upgrade — promotion workflow, audit, indexes
-- Apply after 002_news_content_schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS news_submission_audit (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_submission_audit_news_id
    ON news_submission_audit ((data->>'newsId'));
CREATE INDEX IF NOT EXISTS idx_news_submission_audit_created_at
    ON news_submission_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_submission_audit_data_gin
    ON news_submission_audit USING GIN (data);

COMMENT ON TABLE news_submission_audit IS 'Audit trail for blog main-page promotion and Telegram approvals';

CREATE INDEX IF NOT EXISTS idx_news_content_type ON news ((data->>'contentType'));
CREATE INDEX IF NOT EXISTS idx_news_main_page_status ON news ((data->>'mainPageStatus'));
CREATE INDEX IF NOT EXISTS idx_news_blog_username ON news ((data->>'blogUsername'));
CREATE INDEX IF NOT EXISTS idx_news_site_wide_slug ON news ((data->>'siteWideSlug'));
CREATE INDEX IF NOT EXISTS idx_news_promote_main ON news ((data->>'promoteToMainPage'));
