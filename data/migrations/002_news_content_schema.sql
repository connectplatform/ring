-- ============================================================================
-- News & Announcements — content schema (kingdom-wide, idempotent)
-- Apply: psql "$DATABASE_URL" -f data/migrations/002_news_content_schema.sql
-- Seeds: optional per-ring; ring-ringdom-org uses 002_news_content_schema_en_seed.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS news (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_author_id ON news ((data->>'authorId'));
CREATE INDEX IF NOT EXISTS idx_news_category ON news ((data->>'category'));
CREATE INDEX IF NOT EXISTS idx_news_status ON news ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_news_slug ON news ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news ((data->>'publishedAt'));
CREATE INDEX IF NOT EXISTS idx_news_locale ON news ((data->>'locale'));
CREATE INDEX IF NOT EXISTS idx_news_visibility ON news ((data->>'visibility'));
CREATE INDEX IF NOT EXISTS idx_news_featured ON news ((data->>'featured'));
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_data_gin ON news USING GIN (data);

COMMENT ON TABLE news IS 'News & announcements (JSONB document model)';

CREATE TABLE IF NOT EXISTS news_categories (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_categories_slug ON news_categories ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_news_categories_data_gin ON news_categories USING GIN (data);

COMMENT ON TABLE news_categories IS 'News category metadata';

CREATE TABLE IF NOT EXISTS news_likes (
    id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_likes_news_id ON news_likes ((data->>'newsId'));
CREATE INDEX IF NOT EXISTS idx_news_likes_user_id ON news_likes ((data->>'userId'));

INSERT INTO news_categories (id, data) VALUES
  ('announcements', '{"name":"Announcements","slug":"announcements","description":"Official announcements","color":"bg-yellow-500","icon":"📢"}'),
  ('platform-updates', '{"name":"Platform Updates","slug":"platform-updates","description":"Platform and infrastructure updates","color":"bg-blue-500","icon":"🚀"}'),
  ('community', '{"name":"Community","slug":"community","description":"Community highlights","color":"bg-purple-500","icon":"👥"}'),
  ('security', '{"name":"Security","slug":"security","description":"Security advisories","color":"bg-red-500","icon":"🛡️"}'),
  ('blogs', '{"name":"Blogs","slug":"blogs","description":"Member blog posts promoted to main news","color":"bg-teal-500","icon":"✍️"}')
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();

DROP TRIGGER IF EXISTS update_news_updated_at ON news;
CREATE TRIGGER update_news_updated_at
    BEFORE UPDATE ON news
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_categories_updated_at ON news_categories;
CREATE TRIGGER update_news_categories_updated_at
    BEFORE UPDATE ON news_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
