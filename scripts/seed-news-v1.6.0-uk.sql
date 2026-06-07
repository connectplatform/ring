-- ============================================================================
-- Ring Platform v1.6.0 — UK platform announcement seeds
-- Usage: psql "$DATABASE_URL" -f scripts/seed-news-v1.6.0-uk.sql
-- ============================================================================

INSERT INTO news (id, data) VALUES
(
  'news-v160-open-source-uk',
  '{
    "title": "Ring Platform 1.6.0: Зброя Миру стає публічною",
    "slug": "ring-platform-1-6-0-open-source-uk",
    "content": "Ring Platform **v1.6.0** — найбільша хвиля open-source: PaymentConductor, News Kingdom, науковий редактор, locale SSOT і захищена OSS-межа (без k8s/cli у публічному дереві).\n\n[Changelog](https://github.com/connectplatform/ring/blob/main/CHANGELOG.md) · [Self-hosted](/docs/library/deployment/self-hosted)",
    "excerpt": "v1.6.0: PaymentConductor, News Kingdom, науковий редактор, OSS hardening.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["v1.6.0", "oss", "release"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "uk",
    "publishedAt": "2026-06-06T10:00:00.000Z",
    "createdAt": "2026-06-06T10:00:00.000Z",
    "updatedAt": "2026-06-06T10:00:00.000Z"
  }'::jsonb
),
(
  'news-payment-conductor-uk',
  '{
    "title": "PaymentConductor: один реєстр для магазину, членства та новин",
    "slug": "payment-conductor-unified-payments-uk",
    "content": "PaymentConductor v1 об''єднує WayForPay, Stripe і внутрішній кредит у `payment_transactions`.\n\n[/docs/library/features/payment-conductor](/docs/library/features/payment-conductor)",
    "excerpt": "Єдині платежі для магазину, членства та промоції новин.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["payments", "wayforpay"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-05-22T10:00:00.000Z",
    "createdAt": "2026-05-22T10:00:00.000Z",
    "updatedAt": "2026-05-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-kingdom-uk',
  '{
    "title": "News Kingdom: від CMS до цифрової газети",
    "slug": "news-kingdom-digital-newspaper-uk",
    "content": "Промоція, Telegram-затвердження, OpenRouter-скоринг і блоги учасників.\n\n[/docs/library/architecture/news-kingdom](/docs/library/architecture/news-kingdom)",
    "excerpt": "Цифрова газета з промоцією та блогами.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["news"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-05-21T10:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "updatedAt": "2026-05-21T10:00:00.000Z"
  }'::jsonb
),
(
  'news-locale-config-uk',
  '{
    "title": "Локалі з env: одна конфігурація для маршрутів і SEO",
    "slug": "locale-config-env-driven-i18n-uk",
    "content": "`lib/locale-config.ts` — SSOT для EN/UK/RU.\n\n[/docs/library/features/locale-system](/docs/library/features/locale-system)",
    "excerpt": "NEXT_PUBLIC_SUPPORTED_LOCALES керує маршрутизацією.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["i18n"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-05-28T10:00:00.000Z",
    "createdAt": "2026-05-28T10:00:00.000Z",
    "updatedAt": "2026-05-28T10:00:00.000Z"
  }'::jsonb
),
(
  'news-scientific-editor-uk',
  '{
    "title": "Науковий редактор і API публікацій",
    "slug": "scientific-editor-publications-uk",
    "content": "Редактор з історією версій, рівняннями та `locales/*/editor.json`.\n\n[/docs/library/features/scientific-editor](/docs/library/features/scientific-editor)",
    "excerpt": "Публікації та next-intl для редактора.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "platform-updates",
    "tags": ["editor"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-05-28T11:00:00.000Z",
    "createdAt": "2026-05-28T11:00:00.000Z",
    "updatedAt": "2026-05-28T11:00:00.000Z"
  }'::jsonb
),
(
  'news-member-blog-uk',
  '{
    "title": "Блоги учасників: чисті URL /blog/username",
    "slug": "member-blog-username-routes-uk",
    "content": "Маршрути `/blog/[username]/[slug]` через `lib/blog/blog-path.ts`.\n\n[/docs/library/features/member-blog](/docs/library/features/member-blog)",
    "excerpt": "Канонічна маршрутизація блогів.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "community",
    "tags": ["blog"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-05-29T10:00:00.000Z",
    "createdAt": "2026-05-29T10:00:00.000Z",
    "updatedAt": "2026-05-29T10:00:00.000Z"
  }'::jsonb
),
(
  'news-slim-proxy-uk',
  '{
    "title": "Slim Proxy: Auth.js там, де йому місце",
    "slug": "slim-proxy-authjs-layouts-uk",
    "content": "Авторизація в layouts і API; proxy лише для локалі.\n\n[/docs/library/architecture/proxy-and-intl](/docs/library/architecture/proxy-and-intl)",
    "excerpt": "Без auth loops у middleware.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["auth"],
    "status": "published",
    "visibility": "public",
    "featured": false,
    "locale": "uk",
    "publishedAt": "2026-02-22T10:00:00.000Z",
    "createdAt": "2026-02-22T10:00:00.000Z",
    "updatedAt": "2026-02-22T10:00:00.000Z"
  }'::jsonb
),
(
  'news-oss-security-uk',
  '{
    "title": "Що публікуємо (і що лишається в Kingdom)",
    "slug": "security-oss-publication-uk",
    "content": "v1.6.0 без k8s, Ring CLI та внутрішніх ops-скриптів. Спільнота: install.sh.\n\n[/docs/library/development/oss-vs-enterprise](/docs/library/development/oss-vs-enterprise)",
    "excerpt": "OSS-межа для публічного GitHub.",
    "authorId": "ring-platform",
    "authorName": "Ring Platform",
    "category": "security",
    "tags": ["security", "oss"],
    "status": "published",
    "visibility": "public",
    "featured": true,
    "locale": "uk",
    "publishedAt": "2026-06-06T11:00:00.000Z",
    "createdAt": "2026-06-06T11:00:00.000Z",
    "updatedAt": "2026-06-06T11:00:00.000Z"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
