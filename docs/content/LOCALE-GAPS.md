# Documentation locale gaps (v1.6.0)

**Policy:** EN is canonical. UK and RU v1.6.0 second pass completed 2026-06-06.

## New EN pages — UK/RU status

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `features/payment-conductor.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/scientific-editor.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/member-blog.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/locale-system.mdx` | done-v1.6.0 | done-v1.6.0 |
| `architecture/payment-conductor.mdx` | done-v1.6.0 | done-v1.6.0 |
| `architecture/news-kingdom.mdx` | done-v1.6.0 | done-v1.6.0 |
| `architecture/proxy-and-intl.mdx` | done-v1.6.0 | done-v1.6.0 |
| `getting-started/migrations.mdx` | done-v1.6.0 | done-v1.6.0 |
| `deployment/self-hosted.mdx` | done-v1.6.0 | done-v1.6.0 |
| `development/oss-vs-enterprise.mdx` | done-v1.6.0 | done-v1.6.0 |
| `development/community-tooling.mdx` | done-v1.6.0 | done-v1.6.0 |
| `development/ring-mcp.mdx` | done-v1.6.0 (summary) | done-v1.6.0 (summary) |

**Note:** `ring-mcp` UK/RU are condensed operator guides; full 55-tool reference remains EN canonical.

## Major EN rewrites — UK/RU sync

| EN path | Status |
|---------|--------|
| `features/payments.mdx` | v1.6.0 section prepended (uk, ru) |
| `features/news.mdx` | News Kingdom block (uk, ru) |
| `features/authentication.mdx` | Slim proxy table (uk, ru) |
| `features/tunnel-protocol.mdx` | disconnected-context note (uk, ru) |
| `customization/localization.mdx` | locale-config SSOT (uk, ru) |
| `deployment/environment.mdx` | locale + payment env (uk, ru) |
| `development/local-setup.mdx` | Node 20+, install.sh (uk, ru) |
| `development/code-structure.mdx` | v1.6.0 layout (uk, ru) |
| `api/store.mdx` | PaymentConductor callout (uk, ru) |
| `examples/quick-start.mdx` | install.sh, no CLI (uk, ru) |
| `cli/index.mdx` | Enterprise stub (uk, ru — prior pass) |

**Residual:** Deep body copy on long pages may still reference Next.js 16 in places; grep `Next.js 16` in `docs/content/{uk,ru}` for cleanup backlog.

## News articles

| Script | Locale | Status |
|--------|--------|--------|
| `scripts/seed-news-v1.6.0.sql` | en | done |
| `scripts/seed-news-v1.6.0-uk.sql` | uk | done (8 posts) |
| `scripts/seed-news-v1.6.0-ru.sql` | ru | done (8 posts) |

## Hub pages

- `docs/content/uk/library/meta.json` — synced with EN section list
- `docs/content/ru/library/meta.json` — synced with EN section list
- Section `meta.json` `pages[]` updated for features, architecture, getting-started, deployment, development

## Email AI-CRM (UK/RU)

| Path | Status uk | Status ru |
|------|-----------|-----------|
| `features/email-ai-crm.mdx` | done-v1.6.0 (summary) | done-v1.6.0 (summary) |
| `architecture/email-ai-crm.mdx` | done-v1.6.0 | done-v1.6.0 |
| `api/email-ai-crm.mdx` | done-v1.6.0 | done-v1.6.0 |
| `examples/email-ai-crm.mdx` | done-v1.6.0 | done-v1.6.0 |

EN pages remain canonical for Mermaid diagrams and full API tables.
