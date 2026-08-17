# Ring Platform — database migrations

**Fresh installs (clones):** apply **only** [`data/schema.sql`](../schema.sql) **v4.1.0** (flattened SSOT).

```bash
./install.sh setup-db --clone-name myclone --db-name ring_myclone --create-role
# or
./scripts/setup-clone-db.sh --db-name ring_myclone --db-user ring_user
```

Do **not** replay `data/migrations/*.sql` on an empty database — those files are historical increments already absorbed into `schema.sql`.

**Existing databases:** add a new numbered/dated file under `data/migrations/`, apply it once, then re-flatten:

```bash
./scripts/flatten-schema-from-migrations.sh
```

Legacy `001_email_crm_schema.sql` is skipped during flatten (depends on removed `global_users`; JSONB CRM lives in `009`/`010` and is in `schema.sql`).

## What each migration did (archive)

| File | Purpose |
|------|---------|
| `002_news_content_schema.sql` | `news`, `news_categories`, `news_likes` |
| `003_news_kingdom_upgrade.sql` | Kingdom news fields |
| `004_payment_transactions.sql` | PaymentConductor ledger |
| `005_refcodes_schema.sql` | Referral codes |
| `006` / `007` / `018` | Generative media ledgers |
| `008_*` | Inventory + process_runs |
| `009` / `010` | Email CRM JSONB |
| `011`–`043` | Moderation, FCM, analytics, wallets, NFT, project orders, wiki, file cabinet, peer games, … |
| `044`–`047` | Store carts, docs media, push subscriptions, phone login tokens |
| `048_news_jsonb_fts.sql` | JSONB FTS GIN (title+excerpt+content) + unique `data.wpPostId` |
| `2026-06-13-notification_preferences.sql` | Notification preferences |

Operator runbooks: [EMAIL-CRM-OPS.md](./EMAIL-CRM-OPS.md), [RING-MAILER-OPS.md](./RING-MAILER-OPS.md).

## Docs

- Schema overview: [`../SCHEMA-README.md`](../SCHEMA-README.md)
- Public: `/docs/getting-started/migrations`
