# Pipeline smoke tests (ring-platform.org)

Service-layer E2E checks for payment, store, ERP, refcodes, and platform pipelines. Each suite seeds throwaway `smk*` rows, calls **real** services (not mocks), asserts PostgreSQL state, and cleans up. Safe to re-run against local `ring_platform` dev DB.

**Pipeline registry:** [`PIPELINES.md`](./PIPELINES.md) · **Coverage matrix / backlog:** [`docs/content/SMOKE-GAPS.md`](../docs/content/SMOKE-GAPS.md)

## Prerequisites

1. **PostgreSQL** — `ring_platform` on `localhost:5432` (default dev credentials below).
2. **Schema + migrations** — base `data/schema.sql` plus `data/migrations/*.sql` (including `007_settlements_schema.sql` for store/ERP smokes, `011_entity_moderation.sql` for entity moderation smokes).
3. **Node** — from repo root `ring-platform.org`; uses `npx tsx` with `NODE_OPTIONS="--conditions=react-server"`.

Bootstrap for CI / fresh DB:

```bash
DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
  ./scripts/ci-bootstrap-postgres.sh
```

## Quick start

```bash
cd ring-platform.org
./scripts/run-all-smokes.sh
```

Single suite:

```bash
NODE_OPTIONS="--conditions=react-server" \
DB_BACKEND_MODE=k8s-postgres-fcm \
DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
WAYFORPAY_SECRET_KEY=smoke_wayforpay_secret \
PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY=UAH \
npx tsx scripts/smoke-store-checkout-pipeline.cts
```

Leave seed rows for inspection:

```bash
npx tsx scripts/smoke-erp-referral-pipeline.cts --keep
```

## Environment (defaults in `run-all-smokes.sh`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_OPTIONS` | `--conditions=react-server` | Required for server-only imports |
| `DB_BACKEND_MODE` | `k8s-postgres-fcm` | PostgreSQL adapter |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | localhost / 5432 / `ring_platform` / `ring_user` / `ring_password_2024` | Dev DB |
| `DATABASE_URL` | _(optional)_ | Overrides discrete DB_* when set |
| `WAYFORPAY_SECRET_KEY` | `smoke_wayforpay_secret` | Generic WFP webhooks (news, membership) |
| `WAYFORPAY_STORE_SECRET_KEY` | falls back to `WAYFORPAY_SECRET_KEY` | Store purchase webhook HMAC |
| `PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY` | `UAH` | Required for store credit-checkout smoke |
| `SETTLEMENT_PAYOUT_MODE` | `simulated` | ERP ops smoke (`sim_` payout tx ids) |
| `SMOKE_BASE_URL` | _(unset)_ | Optional HTTP probes (`http://localhost:3000`) |
| `CRON_SECRET` | _(unset)_ | Bearer for `/api/cron/refcodes-mint` HTTP probe |

### Optional HTTP probes

When `next dev` is running, exercise live route handlers:

```bash
SMOKE_BASE_URL=http://localhost:3000 \
CRON_SECRET=your_cron_secret \
./scripts/run-all-smokes.sh
```

Probed routes: `POST /api/payments/wayforpay/webhook`, `POST /api/refcodes/track`, `GET /api/cron/refcodes-mint`. Service-layer assertions always run; HTTP sections warn and skip when `SMOKE_BASE_URL` is unset.

## Suite registry (10)

| Script | ID prefix | What it exercises |
|--------|-----------|-------------------|
| `smoke-erp-referral-pipeline.cts` | `smk_` | Refcodes, attribution, `recordSettlementsForPaidOrder`, rewards, membership referral service, `processApprovedRewards` |
| `smoke-platform-pipelines.cts` | `smk2_` | Payment tx ledger, order CRUD, credit wallet, notifications, username cleanup, messaging, entities |
| `smoke-commerce-pipelines.cts` | `smk3_` | Vendor lifecycle, inventory reservations + TTL cleanup |
| `smoke-growth-pipelines.cts` | `smk4_` | Signup attribution, matcher→notify, news WFP handler, top-up tx-hash replay guard |
| `smoke-webhook-probe.cts` | `smk5_` | `dispatchWayForPayWebhook` for `news_promotion` + optional HTTP |
| `smoke-store-checkout-pipeline.cts` | `smk6_` | WFP `store_order` E2E (stock → settlement → ledger) + internal-credit checkout |
| `smoke-membership-pipeline.cts` | `smk7_` | WFP `membership_upgrade` → role upgrade + ledger |
| `smoke-refcodes-http.cts` | `smk8_` | `trackRefcodeVisit`, cron mint service + optional HTTP auth |
| `smoke-erp-ops.cts` | `smk9_` | `processDueSettlements` simulated payout batch |
| `smoke-entity-moderation-pipeline.cts` | `smk10_` | Entity report/block visibility, matcher suppression, moderation events (requires `011_entity_moderation.sql`) |

## Authoring standard

Follow existing suites (`smoke-commerce-pipelines.cts`, `smoke-erp-referral-pipeline.cts`):

```ts
const KEEP = process.argv.includes('--keep')

function ok(name: string, cond: boolean, detail?: string) { /* pass/fail + console */ }
function warning(name: string, detail: string) { /* non-fatal */ }

async function cleanup() { /* delete smk* rows; query-wipe generated ids */ }
async function seed() { /* minimal fixtures */ }

async function main() {
  await initializeDatabase()
  await cleanup()
  await seed()
  // numbered sections, ok() assertions
  if (!KEEP) await cleanup()
  process.exit(fail > 0 ? 1 : 0)
}
```

- **Unique prefix per suite** (`smk6_`, `smk7_`, …) to avoid collisions when suites run in parallel later.
- **Register** new files in `scripts/run-all-smokes.sh` and `docs/content/SMOKE-GAPS.md`.
- Prefer **service imports** over HTTP unless the route adds auth/middleware you must verify.
- Use **`--keep`** while debugging failed assertions.

## WayForPay test signing

Helper: `scripts/lib/wayforpay-test-sign.ts`

| Webhook type | Signer | Verifier in app |
|--------------|--------|-----------------|
| News, membership | `signGenericWayForPayPayload` — `Object.values(payload).join(';')` | `verifyWayForPayGenericWebhook` |
| Store purchase | `signStoreWayForPayPayload` — fixed field order | `verifyWayForPayStoreWebhook` / `verifyStoreWebhookSignature` |

Order references (`lib/payments/order-reference.ts`):

| Purpose | Format | Example |
|---------|--------|---------|
| `store_order` | `store_{orderId}_{timestamp}` | `store_smk6wfporder_1781100170399` |
| `membership_upgrade` | `membership_{userId}_{timestamp}` | `membership_smk7subscriber_1781100212622` |
| `news_promotion` | `news-promo-{base64url(articleId)}-{timestamp}` | — |

Build refs in smokes:

```ts
import { buildOrderReference } from '@/lib/payments/order-reference'
const ref = buildOrderReference('store_order', { orderId: IDS.wfpOrder })
```

## Vital gotchas (from production smoke hardening)

### Entity IDs must not contain underscores

`parseOrderReference` regexes only capture the segment **before the next underscore**. IDs like `smk6_wfp_order` parse as `smk6`, not the full id — webhooks fail with `Unknown order reference`. Use compact ids: `smk6wfporder`, `smk7subscriber`.

### Store vs generic WFP payloads

Store webhooks require **all** signature fields (`merchantAccount`, `orderReference`, `amount`, `currency`, `authCode`, `cardPan`, `transactionStatus`, `reasonCode`). Partial payloads crash `verifyWayForPayStoreWebhook` before the signature check.

### `'use server'` modules in smokes

Do **not** dynamic-import `'use server'` files from tsx (e.g. `upgrade-user-role`). `wayforpay-service.ts` uses a **static** import of `upgradeUserRole` so membership smokes work outside Next request context.

### Membership webhook replay

First approved webhook upgrades role + marks ledger paid. A **duplicate** dispatch may return `success: false` (role upgrade rejects “same role”) while ledger stays idempotently `paid`. `smoke-membership-pipeline.cts` treats this as a warning, not a failure.

### Settlement payout batch return value

`processDueSettlements()` must return the **final** batch status (`completed` / `partial` / `failed`), not the initial `created` stub — ERP ops smoke asserts on the returned object.

### Expected warnings (non-fatal)

- **Matcher / notify** — `require is not defined` in some notification paths under tsx; growth smoke falls back to direct `createNotification`.
- **Entity moderation** — auth-gated `reportEntity` / `blockEntityForUser` are not invoked; smoke asserts DB contracts + `shouldSuppressMatcherNotificationForUser`. Missing `entity_reports` / `matcher_moderation_events` tables warns (run `011_entity_moderation.sql`).
- **Messaging** — `revalidatePath` outside Next request may warn; message row persistence is still asserted.
- **Price oracle** — Binance unreachable in dev; referral reward sizing uses default price.
- **Tunnel / FCM** — “User not connected” logs are normal in offline smokes.

## Settlement pipeline context

Store paid-order path (covered by `smoke-store-checkout-pipeline.cts`):

```
WFP/credit paid → paymentTransactionService.markPaid
  → StoreOrdersService (paid)
  → ERPStockService.deductStockForOrder
  → VendorSettlementService.processSettlements → recordSettlementsForPaidOrder → settlements table
  → ReferralRewardService.onOrderPaid (when attributed)
```

Admin due payouts (`smoke-erp-ops.cts`): `processDueSettlements` → `payout_batches` + `settlements.status = completed` with `metadata.simulated: true` when `SETTLEMENT_PAYOUT_MODE=simulated`.

## Related docs

- [`docs/content/SMOKE-GAPS.md`](../docs/content/SMOKE-GAPS.md) — funnel coverage table + residual backlog
- [`docs/content/en/library/features/erp/commissions.mdx`](../docs/content/en/library/features/erp/commissions.mdx) — settlements ledger operator guide
- Jest unit tests: `npm test` (e.g. `settlement-pipeline`, `referral-commission`) — complementary, not a substitute for pipeline smokes
