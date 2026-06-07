-- ============================================================================
-- Ring Platform v1.6.0 — EN platform announcement seeds
-- Requires: data/migrations/002_news_content_schema.sql applied
-- Usage: psql "$DATABASE_URL" -f scripts/seed-news-v1.6.0.sql
-- ============================================================================

INSERT INTO news (id, data) VALUES
(
  'news-v160-open-source',
  '{
    "title": "Ring Platform 1.6.0: The Peace Weapon Goes Public",
    "slug": "ring-platform-1-6-0-open-source",
    "content": "Ring Platform **v1.6.0** is the largest open-source release wave to date: PaymentConductor, News Kingdom, scientific editor, locale SSOT, and a hardened OSS boundary (no k8s/cli in the public tree).\n\nRead the [changelog](https://github.com/connectplatform/ring/blob/main/CHANGELOG.md) and [self-hosted guide](/docs/library/deployment/self-hosted).",
    "excerpt": "v1.6.0 ships PaymentConductor, News Kingdom, scientific editor, and OSS security hardening.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["v1.6.0", "oss", "release"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "en",
    "publishedAt": "2026-06-06T10:00:00.000Z",
    "createdAt": "2026-06-06T10:00:00.000Z",
    "updatedAt": "2026-06-06T10:00:00.000Z"
  }'::jsonb
),
(
  'news-payment-conductor',
  '{
    "title": "PaymentConductor: One Ledger for Store, Membership, and News",
    "slug": "payment-conductor-unified-payments",
    "content": "PaymentConductor v1 unifies WayForPay, Stripe, and internal credit behind a single `payment_transactions` ledger.\n\nDocs: [/docs/library/features/payment-conductor](/docs/library/features/payment-conductor)",
    "excerpt": "Config-driven payments for store, membership, and news promotion.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["payments", "wayforpay", "stripe"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-22T10:00:00.000Z",
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-kingdom',
  '{
    "title": "News Kingdom: From CMS to Digital Newspaper",
    "slug": "news-kingdom-digital-newspaper",
    "content": "The News Kingdom upgrade adds promotion workflows, Telegram approval, OpenRouter scoring, and member blogs.\n\nDocs: [/docs/library/architecture/news-kingdom](/docs/library/architecture/news-kingdom)",
    "excerpt": "Digital newspaper experience with promotion and member blogs.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["news", "kingdom"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }'::jsonb
),
(
  'news-locale-config',
  '{
    "title": "Env-Driven Locales: One Config for Routing, SEO, and Prefs",
    "slug": "locale-config-env-driven-i18n",
    "content": "`lib/locale-config.ts` is the single source of truth for EN/UK/RU (env-overridable).\n\nDocs: [/docs/library/features/locale-system](/docs/library/features/locale-system)",
    "excerpt": "NEXT_PUBLIC_SUPPORTED_LOCALES drives routing and SEO.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["i18n", "locale"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-28T10:00:00.000Z",
    "createdAt": "2026-05-28T10:00:00.000Z",
    "updatedAt": "2026-05-28T10:00:00.000Z"
  }'::jsonb
),
(
  'news-scientific-editor',
  '{
    "title": "Scientific Editor and Publications API",
    "slug": "scientific-editor-publications",
    "content": "Authenticated scientific editor with version history, equations, and publications API. UI copy in `locales/*/editor.json`.\n\nDocs: [/docs/library/features/scientific-editor](/docs/library/features/scientific-editor)",
    "excerpt": "Publications API and next-intl editor bundles.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["editor", "publications"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-28T11:00:00.000Z",
    "createdAt": "2026-05-28T11:00:00.000Z",
    "updatedAt": "2026-05-28T11:00:00.000Z"
  }'::jsonb
),
(
  'news-member-blog',
  '{
    "title": "Member Blogs: Clean /blog/username URLs",
    "slug": "member-blog-username-routes",
    "content": "Member blogs now use `/blog/[username]/[slug]` via `lib/blog/blog-path.ts`.\n\nDocs: [/docs/library/features/member-blog](/docs/library/features/member-blog)",
    "excerpt": "Canonical blog routing for member-authored content.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "community",
    "tags": ["blog", "news"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-29T10:00:00.000Z",
    "createdAt": "2026-05-29T10:00:00.000Z",
    "updatedAt": "2026-05-29T10:00:00.000Z"
  }'::jsonb
),
(
  'news-davinci-ux',
  '{
    "title": "DaVinci Mobile UX: Glass Nav and Content Favorites",
    "slug": "davinci-mobile-ux-inline",
    "content": "Vikka-class mobile patterns are inlined in navigation components with a content favorites API.\n\nDocs: [/docs/library/features/news](/docs/library/features/news)",
    "excerpt": "Glass guest auth, fullscreen menu, and favorites.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["mobile", "ux"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-05-29T11:00:00.000Z",
    "createdAt": "2026-05-29T11:00:00.000Z",
    "updatedAt": "2026-05-29T11:00:00.000Z"
  }'::jsonb
),
(
  'news-email-crm',
  '{
    "title": "Email AI CRM for Community Operators",
    "slug": "email-ai-crm-communities",
    "content": "IMAP listener, 4-layer injection defense, draft queue, and CRM contacts for community inboxes.\n\nDocs: [/docs/library/features/email-ai-crm](/docs/library/features/email-ai-crm)",
    "excerpt": "AI-assisted email management with security pipeline.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["email", "crm", "ai"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-02-03T10:00:00.000Z",
    "createdAt": "2026-02-03T10:00:00.000Z",
    "updatedAt": "2026-02-03T10:00:00.000Z"
  }'::jsonb
),
(
  'news-slim-proxy',
  '{
    "title": "Slim Proxy: Auth.js Protection Where It Belongs",
    "slug": "slim-proxy-authjs-layouts",
    "content": "Authorization moves to layouts and API routes; proxy handles locale rewrite only.\n\nDocs: [/docs/library/architecture/proxy-and-intl](/docs/library/architecture/proxy-and-intl)",
    "excerpt": "Fix middleware auth loops with layout-level session gates.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["auth", "proxy"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-02-22T10:00:00.000Z",
    "createdAt": "2026-02-22T10:00:00.000Z",
    "updatedAt": "2026-02-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-backend-modes',
  '{
    "title": "Backend Modes: PostgreSQL, Firebase, and Hybrid",
    "slug": "backend-modes-postgres-firebase",
    "content": "`DB_BACKEND_MODE` selects Postgres-primary vs Firebase-full deployments.\n\nDocs: [/docs/library/architecture/backend-modes-and-databases](/docs/library/architecture/backend-modes-and-databases)",
    "excerpt": "Canonical guide to k8s-postgres-fcm and firebase-full.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["database", "postgres"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2026-02-10T10:00:00.000Z",
    "createdAt": "2026-02-10T10:00:00.000Z",
    "updatedAt": "2026-02-10T10:00:00.000Z"
  }'::jsonb
),
(
  'news-tunnel-protocol',
  '{
    "title": "Tunnel Protocol: Realtime Without Firebase Lock-in",
    "slug": "tunnel-protocol-realtime",
    "content": "Multi-transport pub/sub for K8s and edge deployments.\n\nDocs: [/docs/library/features/tunnel-protocol](/docs/library/features/tunnel-protocol)",
    "excerpt": "WebSocket, SSE, and fallback transports.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["realtime", "tunnel"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "en",
    "publishedAt": "2025-11-15T10:00:00.000Z",
    "createdAt": "2025-11-15T10:00:00.000Z",
    "updatedAt": "2025-11-15T10:00:00.000Z"
  }'::jsonb
),
(
  'news-oss-security',
  '{
    "title": "What We Share (and What Stays in the Kingdom)",
    "slug": "security-oss-publication",
    "content": "v1.6.0 public repo excludes k8s secrets, Ring CLI, and internal ops scripts. Community path: install.sh + env templates.\n\nDocs: [/docs/library/development/oss-vs-enterprise](/docs/library/development/oss-vs-enterprise)",
    "excerpt": "OSS security boundary for public GitHub.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["security", "oss"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "en",
    "publishedAt": "2026-06-06T11:00:00.000Z",
    "createdAt": "2026-06-06T11:00:00.000Z",
    "updatedAt": "2026-06-06T11:00:00.000Z"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
