-- News JSONB FTS + WP import unique (Layer1 globalization)
-- Apply to JSONB news DBs. Vikka already has equivalent indexes from pack cutover.
-- CONCURRENTLY variants: run outside a transaction when applying to large live DBs.

CREATE INDEX IF NOT EXISTS idx_news_fts_simple
  ON news
  USING gin (
    to_tsvector(
      'simple',
      coalesce(data->>'title','') || ' ' ||
      coalesce(data->>'excerpt','') || ' ' ||
      coalesce(data->>'content','')
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_wp_post_id_unique
  ON news ((data->>'wpPostId'))
  WHERE (data->>'wpPostId') IS NOT NULL AND btrim(data->>'wpPostId') <> '';

COMMENT ON INDEX idx_news_fts_simple IS
  'JSONB full-text (simple config) over title+excerpt+content — WP/news-heavy clones';
COMMENT ON INDEX idx_news_wp_post_id_unique IS
  'One news row per WordPress post id for import clones';
