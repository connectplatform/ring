# Ring Platform — database migrations

Apply **after** base schema [`data/schema.sql`](../schema.sql) (v4).

## Order (v1.6.0)

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/ring_platform

psql "$DATABASE_URL" -f data/migrations/002_news_content_schema.sql
psql "$DATABASE_URL" -f data/migrations/003_news_kingdom_upgrade.sql
psql "$DATABASE_URL" -f data/migrations/004_payment_transactions.sql
psql "$DATABASE_URL" -f data/migrations/005_refcodes_schema.sql
psql "$DATABASE_URL" -f data/migrations/006_generated_images_schema.sql
psql "$DATABASE_URL" -f data/migrations/009_email_crm_jsonb.sql
psql "$DATABASE_URL" -f data/migrations/010_email_crm_tasks_jsonb.sql
```

Or use [`scripts/apply-generated-images-migrations-dev.sh`](../scripts/apply-generated-images-migrations-dev.sh) for migration 006.

Or use [`scripts/run-migration.sh`](../scripts/run-migration.sh) when configured for your environment.

## What each migration does

| File | Purpose |
|------|---------|
| `002_news_content_schema.sql` | `news`, `news_categories`, `news_likes` JSONB tables + default categories |
| `003_news_kingdom_upgrade.sql` | Kingdom fields: promotion, blog username, main-page status, AI score columns |
| `004_payment_transactions.sql` | `payment_transactions` ledger for PaymentConductor |
| `005_refcodes_schema.sql` | `refcodes` + `referral_rewards` for referral module |
| `006_generated_images_schema.sql` | `generated_images` ledger for ImageConductor (xAI / Google Imagen) |
| `008_inventory_schema.sql` | `inventory_levels` + `inventory_reservations` (also in `schema.sql` v4.0.1+) |
| `009_email_crm_jsonb.sql` | Email CRM JSONB tables: contacts, threads, messages, drafts |
| `010_email_crm_tasks_jsonb.sql` | Email CRM tasks + `email_api_usage` cost ledger |

**Dev DB name:** `ring_platform` (`DATABASE_URL` in `.env.local`). Clone DBs use their own names (e.g. `ring_ringdom_org`).

### Email CRM — internal production ops

Full Ringdom deploy runbook (secrets paths, k8s cron, `info@ringdom.org`, SMTP smoke test):

→ **[EMAIL-CRM-OPS.md](./EMAIL-CRM-OPS.md)** (operators / LegioX only; not duplicated in public docs)

Public developer setup: `docs/content/en/library/examples/email-ai-crm.mdx`.

## Optional news seeds

Community announcements: [`scripts/seed-news-v1.6.0.sql`](../scripts/seed-news-v1.6.0.sql) (EN platform posts for v1.6.0).

## Docs

- [Getting started: migrations](/docs/library/getting-started/migrations)
- [News Kingdom architecture](/docs/library/architecture/news-kingdom)
- [PaymentConductor](/docs/library/features/payment-conductor)
- [Referral Codes](/docs/library/features/refcodes)
- [Email AI-CRM](/docs/library/features/email-ai-crm)
- [EMAIL-CRM-OPS.md](./EMAIL-CRM-OPS.md) — internal ring-ringdom-org production runbook
