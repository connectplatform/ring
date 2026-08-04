-- ============================================================================
-- 045_docs_media_and_enrichment.sql
-- Docs Play narration cache + article enrichment (audible-text / tts-audio / llm-text).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generated_docs_media (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT generated_docs_media_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.generated_docs_media IS
  'Cached docs narration/walkthrough media URLs keyed by locale+slug+contentHash';

CREATE INDEX IF NOT EXISTS idx_generated_docs_media_kind
  ON public.generated_docs_media USING btree (((data ->> 'kind'::text)));
CREATE INDEX IF NOT EXISTS idx_generated_docs_media_locale
  ON public.generated_docs_media USING btree (((data ->> 'locale'::text)));
CREATE INDEX IF NOT EXISTS idx_generated_docs_media_slug
  ON public.generated_docs_media USING btree (((data ->> 'slug'::text)));
CREATE INDEX IF NOT EXISTS idx_generated_docs_media_content_hash
  ON public.generated_docs_media USING btree (((data ->> 'contentHash'::text)));
CREATE INDEX IF NOT EXISTS idx_generated_docs_media_data_gin
  ON public.generated_docs_media USING gin (data);

CREATE TABLE IF NOT EXISTS public.docs_article_enrichment (
    id character varying(255) NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT docs_article_enrichment_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.docs_article_enrichment IS
  'Derived docs fields: audible-text (radio-host script), tts-audio meta, llm-text NODUS subtree';

CREATE INDEX IF NOT EXISTS idx_docs_article_enrichment_locale
  ON public.docs_article_enrichment USING btree (((data ->> 'locale'::text)));
CREATE INDEX IF NOT EXISTS idx_docs_article_enrichment_slug
  ON public.docs_article_enrichment USING btree (((data ->> 'slug'::text)));
CREATE INDEX IF NOT EXISTS idx_docs_article_enrichment_content_hash
  ON public.docs_article_enrichment USING btree (((data ->> 'contentHash'::text)));
CREATE INDEX IF NOT EXISTS idx_docs_article_enrichment_data_gin
  ON public.docs_article_enrichment USING gin (data);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_generated_docs_media_updated_at ON public.generated_docs_media;
CREATE TRIGGER update_generated_docs_media_updated_at
  BEFORE UPDATE ON public.generated_docs_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_docs_article_enrichment_updated_at ON public.docs_article_enrichment;
CREATE TRIGGER update_docs_article_enrichment_updated_at
  BEFORE UPDATE ON public.docs_article_enrichment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO schema_versions (version, description, applied_by)
SELECT '045',
       '045_docs_media_and_enrichment: generated_docs_media + docs_article_enrichment',
       current_user
WHERE NOT EXISTS (
  SELECT 1 FROM schema_versions WHERE version = '045'
);
