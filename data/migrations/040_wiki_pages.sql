-- 040_wiki_pages.sql
-- Admin Wiki vault: pages + link edges + append-only events (Obsidian-like KB).

CREATE TABLE IF NOT EXISTS wiki_pages (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_vault_key
  ON wiki_pages ((data->>'vaultKey'));
CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug
  ON wiki_pages ((data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_wiki_pages_path
  ON wiki_pages ((data->>'path'));
CREATE INDEX IF NOT EXISTS idx_wiki_pages_kind
  ON wiki_pages ((data->>'kind'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_wiki_pages_vault_slug
  ON wiki_pages ((data->>'vaultKey'), (data->>'slug'));
CREATE INDEX IF NOT EXISTS idx_wiki_pages_updated_at
  ON wiki_pages (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_data_gin
  ON wiki_pages USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_fts
  ON wiki_pages USING GIN (
    to_tsvector(
      'english',
      coalesce(data->>'title', '') || ' ' ||
      coalesce(data->>'bodyMarkdown', '') || ' ' ||
      coalesce(data->>'path', '') || ' ' ||
      coalesce(data->>'slug', '')
    )
  );

COMMENT ON TABLE wiki_pages IS
  'Admin Wiki Markdown pages — vaultKey tenant|po:{orderId}, [[wikilinks]], agent+human KB';

CREATE TABLE IF NOT EXISTS wiki_links (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_links_from_id
  ON wiki_links ((data->>'fromId'));
CREATE INDEX IF NOT EXISTS idx_wiki_links_to_vault
  ON wiki_links ((data->>'toVaultKey'));
CREATE INDEX IF NOT EXISTS idx_wiki_links_to_slug
  ON wiki_links ((data->>'toSlug'));
CREATE INDEX IF NOT EXISTS idx_wiki_links_to_id
  ON wiki_links ((data->>'toId'));
CREATE INDEX IF NOT EXISTS idx_wiki_links_data_gin
  ON wiki_links USING GIN (data);

COMMENT ON TABLE wiki_links IS
  'Admin Wiki graph edges (SSOT) — local + tenant_ref (@ / tenant:) wikilinks';

CREATE TABLE IF NOT EXISTS wiki_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_events_vault_key
  ON wiki_events ((data->>'vaultKey'));
CREATE INDEX IF NOT EXISTS idx_wiki_events_at
  ON wiki_events ((data->>'at') DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_events_page_id
  ON wiki_events ((data->>'pageId'));
CREATE INDEX IF NOT EXISTS idx_wiki_events_data_gin
  ON wiki_events USING GIN (data);

COMMENT ON TABLE wiki_events IS
  'Admin Wiki append-only ops log (derived catalog — not a Markdown page)';
