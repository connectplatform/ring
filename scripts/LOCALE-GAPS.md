# Documentation locale gaps (v1.6.4)

**Policy:** EN is canonical. UK and RU v1.6.0 second pass completed 2026-06-06.

**Content paths (v1.6.4):** Physical MDX root is `docs/{locale}/` — the `library/` directory segment is **retired**. Tables below use paths relative to that root (no `library/` prefix). Canonical paths only — no `/docs/library/` segment.

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
| `development/ring-mcp.mdx` | done-v1.6.0 (summary, 57 tools) | done-v1.6.0 (summary, 57 tools) |
| `development/generative-images.mdx` | done-v1.6.0 (summary) | done-v1.6.0 (summary) |
| `development/generative-newsroom.mdx` | done-v1.6.0 (summary) | done-v1.6.0 (summary) |
| `features/refcodes.mdx` | done-v1.6.0 (summary) | done-v1.6.0 (summary) |
| `architecture/refcodes.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/erp/index.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/erp/inventory.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/erp/vendor-management.mdx` | done-v1.6.0 | done-v1.6.0 |
| `features/erp/commissions.mdx` | done-v1.6.0 | done-v1.6.0 |

## Affiliate enablement (EN canonical 2026-06-12)

Dual-rail referral reconciliation (ERP vendor commission + refcodes token rewards), visit analytics, checkout UX, mint notification i18n.

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `features/affiliate-enablement.mdx` | **pending** (EN canonical) | **pending** (EN canonical) |

**EN refresh (2026-06-12):** `features/refcodes.mdx`, `architecture/refcodes.mdx`, `features/erp/commissions.mdx`, `features/erp/index.mdx` — UK/RU summaries not yet updated for visit analytics, checkout flash, dual-rail hub link.

**Note:** `ring-mcp` UK/RU are condensed operator guides; full 57-tool reference remains EN canonical. Generative conductor UK/RU pages are operator summaries; full parameter tables and troubleshooting remain EN canonical. **Refcodes + ERP UK/RU (2026-06-10):** operator summaries with `<Mermaid>` flow diagrams; EN remains canonical for contract deploy steps, full env tables, and `REFERRAL-ONCHAIN-OPS.md`.

## Email AI-CRM (EN canonical 2026-06-10)

Production: migrations `009`/`010`, JSONB repos, cron poll, admin APIs/UI, inbound webhook.

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `features/email-ai-crm.mdx` | done-v1.6.0 (summary + Mermaid) | done-v1.6.0 (summary + Mermaid) |
| `architecture/email-ai-crm.mdx` | done-v1.6.0 | done-v1.6.0 |
| `api/email-ai-crm.mdx` | done-v1.6.0 (route tables) | done-v1.6.0 (route tables) |
| `examples/email-ai-crm.mdx` | done-v1.6.0 | done-v1.6.0 |
| `getting-started/migrations.mdx` | synced 2026-06-10 (`005`, `009`, `010`) | synced 2026-06-10 |
| `deployment/environment.mdx` | synced 2026-06-10 (`#email-ai-crm`) | synced 2026-06-10 |

**Note:** UK/RU are operator summaries per refcodes pattern; full API bodies, webhook JSON, and extended troubleshooting remain EN canonical.

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

**Residual:** Deep body copy on long pages may still reference Next.js 16 in places; grep `Next.js 16` in `docs/{uk,ru}` for cleanup backlog.

## News articles

| Script | Locale | Status |
|--------|--------|--------|
| `scripts/seed-news-v1.6.0.sql` | en | done |
| `scripts/seed-news-v1.6.0-uk.sql` | uk | done (8 posts) |
| `scripts/seed-news-v1.6.0-ru.sql` | ru | done (8 posts) |

## Development — docs components (2026-06-10)

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `development/docs-components.mdx` | done-v1.6.0 (full parity) | done-v1.6.0 (full parity) |

**Note:** EN canonical for component API details and file paths; UK/RU mirror structure and live component demos.

## Architecture hub (2026-06-10)

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `architecture/index.mdx` | done-v1.6.0 (full hub rewrite) | done-v1.6.0 (full hub rewrite) |

**Note:** EN/UK/RU share structure — executive summary, system Mermaid, Developer/Operator Tabs, Cards to all child pages. Child architecture articles remain EN-canonical for deep tables unless marked done above.

## Customization (2026-06-12, paths flattened 2026-06-13)

**IA:** `white-label/` removed — operator + UI guides unified under `customization/`. Links: `/docs/customization/*`.

| EN path | Status uk | Status ru |
|---------|-----------|-----------|
| `customization/index.mdx` | done-v1.6.0 (hub 2026-06-12) | partial (hub stub) |
| `customization/quick-start.mdx` | legacy (Firebase-first prose) | **missing** |
| `customization/customization-guide.mdx` | legacy | **missing** |
| `customization/database-selection.mdx` | partial (DB_BACKEND_MODE callout) | **missing** |
| `customization/payment-integration.mdx` | **missing** (EN PaymentConductor operator summary 2026-06-12) | **missing** |
| `customization/token-economics.mdx` | done-v1.6.0 (RING contracts rewrite) | done-v1.6.0 (RING contracts rewrite) |
| `customization/multi-tenant.mdx` | legacy | **missing** |
| `customization/ai-customization.mdx` | legacy | **missing** |
| `customization/success-stories.mdx` | summary table (2026-06-12) | **missing** |

**Note:** EN `quick-start` + `customization-guide` rewritten 2026-06-12. Hub: Ringdom → ringdom.org chat; Quick Start = OSS only. `payment-integration` EN canonical for PaymentConductor operator setup. `success-stories` EN rewritten 2026-06-12 — named clone table only; fictional KPI vignettes removed.

## Hub pages

- `docs/uk/meta.json` — synced with EN section list
- `docs/ru/meta.json` — synced with EN section list
- Section `meta.json` `pages[]` updated for features, architecture, getting-started, deployment, development, api, examples

## Residual prose cleanup (v1.6.4)

Bulk link sweep completed 2026-06-13. Docs physical root is `docs/{locale}/` (retired `docs/content/` wrapper and `library/` segment). `/docs/library/...` URLs are not supported. Canonical authoring reference: `development/docs-components.mdx`.
