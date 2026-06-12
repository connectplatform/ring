# Pipeline smoke-test gaps (ring-platform.org)

**Policy:** Service-layer smokes in `scripts/smoke-*.cts` seed `smk_*` rows, exercise real services, assert DB state, clean up. Runner: `scripts/run-all-smokes.sh`. **Canonical pipeline list + TODO backlog:** [`scripts/PIPELINES.md`](../../scripts/PIPELINES.md). **How-to / env / gotchas:** [`scripts/SMOKE-TESTS.md`](../../scripts/SMOKE-TESTS.md). Optional HTTP probes use `SMOKE_BASE_URL` + `CRON_SECRET` (same pattern as `smoke-webhook-probe.cts`).

**Baseline (2026-06-10):** 5 suites before this pass — ERP/referral service path, platform ledger/messaging, commerce vendor/inventory, growth attribution/matcher/news, WFP dispatch for `news_promotion` only.

## Payment conductor funnels

| Funnel | Entry | Existing coverage | Status | Planned suite |
|--------|-------|-------------------|--------|---------------|
| `news_promotion` (WFP) | `dispatchWayForPayWebhook` | `smoke-webhook-probe.cts`, partial in `smoke-growth-pipelines.cts` | **done** | — |
| `store_order` (WFP) | `handleStoreWayForPayWebhook` → stock → settlement → referral | Ledger CRUD only in `smoke-platform-pipelines.cts`; settlement math in `smoke-erp-referral-pipeline.cts` (direct `recordSettlementsForPaidOrder`) | **missing** → **done** | `smoke-store-checkout-pipeline.cts` |
| `store_order` (credit) | `POST /api/store/payments/credit` + `PaymentConductor` internal credit | Wallet spend only in `smoke-platform-pipelines.cts` | **missing** → **done** | `smoke-store-checkout-pipeline.cts` §2 |
| `membership_upgrade` (WFP) | `handleMembershipWayForPayWebhook` → role upgrade + referral | `ReferralRewardService.onMembershipPaid` only in `smoke-erp-referral-pipeline.cts` | **missing** → **done** | `smoke-membership-pipeline.cts` |
| `membership_upgrade` (credit) | `POST /api/membership/payment/credit` | none | **missing** | backlog — needs session/auth harness |
| Stripe (`news_promotion`) | `dispatchStripeWebhook` | none | **missing** | backlog — needs signed fixture + `STRIPE_WEBHOOK_SECRET` |
| Wallet top-up (on-chain) | `POST /api/wallet/credit/topup` | Replay guard only in `smoke-growth-pipelines.cts` | **partial** | backlog — full verify + credit add |

## ERP / store ops

| Funnel | Entry | Existing coverage | Status | Planned suite |
|--------|-------|-------------------|--------|---------------|
| Settlement ledger write | `recordSettlementsForPaidOrder` | `smoke-erp-referral-pipeline.cts` | **done** | — |
| Stock deduct on paid order | `ERPStockService.deductStockForOrder` | none end-to-end | **missing** → **done** | `smoke-store-checkout-pipeline.cts` |
| Due payout batch | `processDueSettlements` | none | **missing** → **done** | `smoke-erp-ops.cts` |
| Admin store actions | `processDueSettlementsAction` | none | **partial** (same service as cron) | `smoke-erp-ops.cts` |
| Inventory reservations | `reserveInventory` / TTL cleanup | `smoke-commerce-pipelines.cts` | **done** | — |
| Vendor lifecycle | `createVendorProfile` … suspend/reinstate | `smoke-commerce-pipelines.cts` | **done** | — |

## Refcodes / growth

| Funnel | Entry | Existing coverage | Status | Planned suite |
|--------|-------|-------------------|--------|---------------|
| Refcode mint + attribution guards | `RefcodeService`, `resolveOrderReferral` | `smoke-erp-referral-pipeline.cts` | **done** | — |
| Signup attribution | `persistSignupReferralAttribution` | `smoke-growth-pipelines.cts` | **done** | — |
| Visit beacon (service) | `trackRefcodeVisit` | `smoke-growth-pipelines.cts` | **done** | — |
| Visit beacon (HTTP) | `POST /api/refcodes/track` | none | **missing** → **done** | `smoke-refcodes-http.cts` |
| Cron mint (service) | `processApprovedRewards` | `smoke-erp-referral-pipeline.cts` §6 | **done** | — |
| Cron mint (HTTP) | `GET /api/cron/refcodes-mint` | none | **missing** → **done** | `smoke-refcodes-http.cts` |
| Matcher → notify | `matchAndNotifyUsers` | `smoke-growth-pipelines.cts` (warn on fallback) | **partial** | backlog — LLM/profile dependent |

## Platform (non-payment)

| Funnel | Entry | Existing coverage | Status |
|--------|-------|-------------------|--------|
| Payment tx ledger | `paymentTransactionService` | `smoke-platform-pipelines.cts` | **done** |
| Order CRUD (no webhook) | `StoreOrdersService` | `smoke-platform-pipelines.cts` | **partial** |
| Notifications | `createNotification` … | `smoke-platform-pipelines.cts` | **done** |
| Messaging | `MessageService` | `smoke-platform-pipelines.cts` | **done** |
| Username cleanup cron | `cleanup-usernames` | none | **missing** |
| Auth / OAuth sign-in | `auth.ts` events | none | **missing** |
| Opportunities CRUD | API routes | none | **missing** |
| Email AI-CRM cron | `email-processor` | none | **missing** |
| MCP gateway credit | `/api/mcp/v1/credit/*` | none | **missing** |
| Platform settings / AI resolver | `platform_settings`, `getResolvedAIConfig` | `smoke-platform-settings.cts` | **done** |
| Entity moderation visibility | `filterEntitiesForDiscovery` | `smoke-entity-moderation-pipeline.cts` | **done** |
| Entity report persistence | `entity_reports` + `reportCount` | `smoke-entity-moderation-pipeline.cts` | **done** (DB contract; no auth session) |
| User block + matcher suppress | `blockedEntityIds`, `notifyMatchedUsers` | `smoke-entity-moderation-pipeline.cts` | **done** |
| Admin global block | `moderationStatus=blocked` | `smoke-entity-moderation-pipeline.cts` | **partial** (DB contract; admin API/session backlog) |
| Matcher moderation events | `notifyMatcherEntityModeration` | `smoke-entity-moderation-pipeline.cts` | **done** |

## Suite registry

| Script | Prefix | Sections |
|--------|--------|----------|
| `smoke-erp-referral-pipeline.cts` | `smk_` | refcode, attribution, settlement pipeline, rewards, membership referral service, cron mint queue |
| `smoke-platform-pipelines.cts` | `smk2_` | ledger, order lifecycle, credit wallet, notifications, usernames, messaging, entities |
| `smoke-commerce-pipelines.cts` | `smk3_` | vendor lifecycle, inventory reservations |
| `smoke-growth-pipelines.cts` | `smk4_` | signup attribution, matcher, news WFP handler, top-up replay guard |
| `smoke-webhook-probe.cts` | `smk5_` | WFP dispatch `news_promotion` + optional HTTP |
| `smoke-store-checkout-pipeline.cts` | `smk6_` | WFP `store_order` webhook E2E, internal-credit checkout E2E |
| `smoke-membership-pipeline.cts` | `smk7_` | WFP `membership_upgrade` dispatch + role upgrade |
| `smoke-refcodes-http.cts` | `smk8_` | track + cron mint HTTP auth (optional `SMOKE_BASE_URL`) |
| `smoke-erp-ops.cts` | `smk9_` | `processDueSettlements` simulated payout batch |
| `smoke-entity-moderation-pipeline.cts` | `smk10_` | visibility filter, report rows, user block, matcher suppress, admin block, moderation events |
| `smoke-platform-settings.cts` | _(patches `ai` row)_ | `upsertPlatformNamespace`, `getPlatformAIData`, `getResolvedAIConfig` |

## Smoke authoring notes

- **Order-reference entity IDs must not contain underscores** — `parseOrderReference` uses `store_{id}_{ts}` / `membership_{id}_{ts}` patterns that break when `id` includes `_`. Smoke prefixes use compact ids (`smk6wfporder`, `smk7subscriber`).
- **Membership webhook replay** — duplicate WFP dispatch keeps ledger paid but may return `success: false` when role is already upgraded (documented warning in `smoke-membership-pipeline.cts`).
- **HTTP probes** — optional; set `SMOKE_BASE_URL` and `CRON_SECRET` when a dev server is running.

## Running

```bash
cd ring-platform.org
./scripts/run-all-smokes.sh

# Optional live route probes
SMOKE_BASE_URL=http://localhost:3000 CRON_SECRET=your_secret ./scripts/run-all-smokes.sh
```

## Residual backlog (not in runner yet)

- Membership credit checkout (`/api/membership/payment/credit`) — auth session required
- Stripe webhook dispatch — signed event fixture
- Full wallet top-up verify → credit balance
- Username / reservation cleanup crons (HTTP 401 without secret)
- Auth OAuth + `referredBy` on first sign-in
- Opportunities, editor/news admin, email CRM, tunnel/FCM, MCP gateway
- Entity moderation auth actions (`reportEntity`, `blockEntityForUser`, `adminBlockEntity`) + admin queue HTTP — session harness
