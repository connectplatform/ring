# Ring Platform — database migrations

Apply in order:

```bash
psql "$DATABASE_URL" -f data/migrations/002_news_content_schema.sql
psql "$DATABASE_URL" -f data/migrations/003_news_kingdom_upgrade.sql
```

Kingdom matrix: [AI-CONTEXT/ring-platform.org/workflows/news-kingdom-db-matrix.json](../../../AI-CONTEXT/ring-platform.org/workflows/news-kingdom-db-matrix.json)

**ring-ringdom-org prod (k3s-3):** use [scripts/apply-news-migrations-ringdom-prod.sh](../scripts/apply-news-migrations-ringdom-prod.sh) via jump host; EN security seed is in `ring-ringdom-org/data/migrations/002_news_content_schema_en_seed.sql`.
