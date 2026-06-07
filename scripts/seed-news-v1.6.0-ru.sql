-- ============================================================================
-- Ring Platform v1.6.0 — RU platform announcement seeds
-- Usage: psql "$DATABASE_URL" -f scripts/seed-news-v1.6.0-ru.sql
-- ============================================================================

INSERT INTO news (id, data) VALUES
(
  'news-v160-open-source-ru',
  '{
    "title": "Ring Platform 1.6.0: Оружие Мира становится публичным",
    "slug": "ring-platform-1-6-0-open-source-ru",
    "content": "Ring Platform **v1.6.0** — крупнейшая open-source волна: PaymentConductor, News Kingdom, научный редактор, locale SSOT и OSS-граница (без k8s/cli в публичном дереве).\n\n[Changelog](https://github.com/connectplatform/ring/blob/main/CHANGELOG.md) · [Self-hosted](/docs/library/deployment/self-hosted)",
    "excerpt": "v1.6.0: PaymentConductor, News Kingdom, научный редактор, OSS hardening.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["v1.6.0", "oss", "release"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "ru",
    "publishedAt": "2026-06-06T10:00:00.000Z",
    "createdAt": "2026-06-06T10:00:00.000Z",
    "updatedAt": "2026-06-06T10:00:00.000Z"
  }'::jsonb
),
(
  'news-payment-conductor-ru',
  '{
    "title": "PaymentConductor: один реестр для магазина, членства и новостей",
    "slug": "payment-conductor-unified-payments-ru",
    "content": "PaymentConductor v1 объединяет WayForPay, Stripe и внутренний кредит в `payment_transactions`.\n\n[/docs/library/features/payment-conductor](/docs/library/features/payment-conductor)",
    "excerpt": "Единые платежи для магазина, членства и промоции новостей.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["payments", "wayforpay"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-05-22T10:00:00.000Z",
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-kingdom-ru',
  '{
    "title": "News Kingdom: от CMS к цифровой газете",
    "slug": "news-kingdom-digital-newspaper-ru",
    "content": "Промоция, Telegram-одобрение, OpenRouter-скоринг и блоги участников.\n\n[/docs/library/architecture/news-kingdom](/docs/library/architecture/news-kingdom)",
    "excerpt": "Цифровая газета с промоцией и блогами.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["news"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }'::jsonb
),
(
  'news-locale-config-ru',
  '{
    "title": "Локали из env: одна конфигурация для маршрутов и SEO",
    "slug": "locale-config-env-driven-i18n-ru",
    "content": "`lib/locale-config.ts` — SSOT для EN/UK/RU.\n\n[/docs/library/features/locale-system](/docs/library/features/locale-system)",
    "excerpt": "NEXT_PUBLIC_SUPPORTED_LOCALES управляет маршрутизацией.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["i18n"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-05-28T10:00:00.000Z",
    "createdAt": "2026-05-28T10:00:00.000Z",
    "updatedAt": "2026-05-28T10:00:00.000Z"
  }'::jsonb
),
(
  'news-scientific-editor-ru',
  '{
    "title": "Научный редактор и API публикаций",
    "slug": "scientific-editor-publications-ru",
    "content": "Редактор с историей версий, уравнениями и `locales/*/editor.json`.\n\n[/docs/library/features/scientific-editor](/docs/library/features/scientific-editor)",
    "excerpt": "Публикации и next-intl для редактора.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["editor"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-05-28T11:00:00.000Z",
    "createdAt": "2026-05-28T11:00:00.000Z",
    "updatedAt": "2026-05-28T11:00:00.000Z"
  }'::jsonb
),
(
  'news-member-blog-ru',
  '{
    "title": "Блоги участников: чистые URL /blog/username",
    "slug": "member-blog-username-routes-ru",
    "content": "Маршруты `/blog/[username]/[slug]` через `lib/blog/blog-path.ts`.\n\n[/docs/library/features/member-blog](/docs/library/features/member-blog)",
    "excerpt": "Каноническая маршрутизация блогов.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "community",
    "tags": ["blog"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-05-29T10:00:00.000Z",
    "createdAt": "2026-05-29T10:00:00.000Z",
    "updatedAt": "2026-05-29T10:00:00.000Z"
  }'::jsonb
),
(
  'news-slim-proxy-ru',
  '{
    "title": "Slim Proxy: Auth.js там, где ему место",
    "slug": "slim-proxy-authjs-layouts-ru",
    "content": "Авторизация в layouts и API; proxy только для локали.\n\n[/docs/library/architecture/proxy-and-intl](/docs/library/architecture/proxy-and-intl)",
    "excerpt": "Без auth loops в middleware.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["auth"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "ru",
    "publishedAt": "2026-02-22T10:00:00.000Z",
    "createdAt": "2026-02-22T10:00:00.000Z",
    "updatedAt": "2026-02-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-oss-security-ru',
  '{
    "title": "Что публикуем (и что остаётся в Kingdom)",
    "slug": "security-oss-publication-ru",
    "content": "v1.6.0 без k8s, Ring CLI и внутренних ops-скриптов. Сообщество: install.sh.\n\n[/docs/library/development/oss-vs-enterprise](/docs/library/development/oss-vs-enterprise)",
    "excerpt": "OSS-граница для публичного GitHub.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["security", "oss"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "ru",
    "publishedAt": "2026-06-06T11:00:00.000Z",
    "createdAt": "2026-06-06T11:00:00.000Z",
    "updatedAt": "2026-06-06T11:00:00.000Z"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
