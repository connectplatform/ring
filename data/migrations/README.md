# Ring Platform — database migrations

Apply **after** base schema [`data/schema.sql`](../schema.sql) (v4).

## Order (v1.6.0)

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/ring_platform

psql "$DATABASE_URL" -f data/migrations/002_news_content_schema.sql
psql "$DATABASE_URL" -f data/migrations/003_news_kingdom_upgrade.sql
psql "$DATABASE_URL" -f data/migrations/004_payment_transactions.sql
```

Or use [`scripts/run-migration.sh`](../scripts/run-migration.sh) when configured for your environment.

## What each migration does

| File | Purpose |
|------|---------|
| `002_news_content_schema.sql` | `news`, `news_categories`, `news_likes` JSONB tables + default categories |
| `003_news_kingdom_upgrade.sql` | Kingdom fields: promotion, blog username, main-page status, AI score columns |
| `004_payment_transactions.sql` | `payment_transactions` ledger for PaymentConductor |

## Optional news seeds

Community announcements: [`scripts/seed-news-v1.6.0.sql`](../scripts/seed-news-v1.6.0.sql) (EN platform posts for v1.6.0).

## Docs

- [Getting started: migrations](/docs/library/getting-started/migrations)
- [News Kingdom architecture](/docs/library/architecture/news-kingdom)
- [PaymentConductor](/docs/library/features/payment-conductor)
