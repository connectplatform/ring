# Ring Platform — Pipeline Registry

Canonical catalog of **known pipelines** exercised by `scripts/smoke-*.cts` suites.  
Companion docs: [`SMOKE-TESTS.md`](./SMOKE-TESTS.md) (how to run) · [`docs/content/SMOKE-GAPS.md`](../docs/content/SMOKE-GAPS.md) (coverage matrix).

**Last updated:** 2026-06-10 · **Suites in runner:** 10 · **ID prefixes:** `smk_` … `smk10_`

---

## How to read this document

| Column | Meaning |
|--------|---------|
| **Pipeline ID** | Stable name for CI dashboards and backlog tickets |
| **Suite** | `scripts/smoke-*.cts` that asserts it |
| **Prefix** | Throwaway row prefix (`smk6_`, etc.) |
| **Layer** | `service` = direct import; `dispatch` = webhook dispatcher; `http` = optional `SMOKE_BASE_URL` probe |

---

## Covered pipelines (45)

### Payment & checkout

| Pipeline ID | Suite | Prefix | Entry / flow | Layer |
|-------------|-------|--------|--------------|-------|
| `payment.tx.ledger` | `smoke-platform-pipelines` | `smk2_` | `paymentTransactionService` createPending → markPaid idempotency | service |
| `news_promotion.wfp.dispatch` | `smoke-webhook-probe` | `smk5_` | `dispatchWayForPayWebhook` signed `news_promotion` | dispatch |
| `news_promotion.wfp.handler` | `smoke-growth-pipelines` | `smk4_` | `handleNewsWayForPayWebhook` → article `awaiting_admin_approval` | service |
| `news_promotion.wfp.http` | `smoke-webhook-probe` | `smk5_` | `POST /api/payments/wayforpay/webhook` | http |
| `store_order.wfp.e2e` | `smoke-store-checkout-pipeline` | `smk6_` | WFP dispatch → `handleStoreWayForPayWebhook` → stock → settlement → ledger | dispatch |
| `store_order.credit.e2e` | `smoke-store-checkout-pipeline` | `smk6_` | `PaymentConductor` internal credit → stock → settlement | service |
| `membership_upgrade.wfp.e2e` | `smoke-membership-pipeline` | `smk7_` | WFP dispatch → `processSuccessfulPayment` → `upgradeUserRole` | dispatch |
| `membership_upgrade.wfp.declined` | `smoke-membership-pipeline` | `smk7_` | Declined WFP payload → no role change | dispatch |
| `membership_upgrade.wfp.replay` | `smoke-membership-pipeline` | `smk7_` | Duplicate approved webhook → ledger idempotent (warn on role) | dispatch |
| `wallet.topup.replay_guard` | `smoke-growth-pipelines` | `smk4_` | `reserveTopUpTxHash` + `verifyTopUpTransaction` fail-closed | service |

### ERP, store & commerce

| Pipeline ID | Suite | Prefix | Entry / flow | Layer |
|-------------|-------|--------|--------------|-------|
| `settlement.record_paid_order` | `smoke-erp-referral-pipeline` | `smk_` | `recordSettlementsForPaidOrder` + idempotency | service |
| `settlement.due_payout_batch` | `smoke-erp-ops` | `smk9_` | `processDueSettlements` → `payout_batches` + simulated tx | service |
| `erp.stock.deduct_on_paid` | `smoke-store-checkout-pipeline` | `smk6_` | `ERPStockService.deductStockForOrder` + referral metadata | service |
| `erp.sales_assists` | `smoke-erp-referral-pipeline` | `smk_` | `erp_sales_assists` row on referred order | service |
| `store.order.crud` | `smoke-platform-pipelines` | `smk2_` | `StoreOrdersService` create + paid status (no webhook) | service |
| `vendor.lifecycle` | `smoke-commerce-pipelines` | `smk3_` | `createVendorProfile` → approve → performance → suspend/reinstate | service |
| `inventory.reservations` | `smoke-commerce-pipelines` | `smk3_` | `reserveInventory` / release / TTL `cleanupExpiredReservations` | service |

### Refcodes & growth

| Pipeline ID | Suite | Prefix | Entry / flow | Layer |
|-------------|-------|--------|--------------|-------|
| `refcode.create` | `smoke-erp-referral-pipeline` | `smk_` | `RefcodeService.getOrCreateForWallet` | service |
| `referral.attribution.guards` | `smoke-erp-referral-pipeline` | `smk_` | `resolveOrderReferral` self-ref / unknown code blocks | service |
| `referral.reward.order_paid` | `smoke-erp-referral-pipeline` | `smk_` | `ReferralRewardService.onOrderPaid` fiat → `pending_approval` | service |
| `referral.reward.membership` | `smoke-erp-referral-pipeline` | `smk_` | `ReferralRewardService.onMembershipPaid` via `referredBy` | service |
| `referral.mint.queue_empty` | `smoke-erp-referral-pipeline` | `smk_` | `processApprovedRewards` on empty queue | service |
| `referral.signup_attribution` | `smoke-growth-pipelines` | `smk4_` | `persistSignupReferralAttribution` first-touch | service |
| `referral.visit_track` | `smoke-growth-pipelines`, `smoke-refcodes-http` | `smk4_` / `smk8_` | `trackRefcodeVisit` | service |
| `referral.track.http` | `smoke-refcodes-http` | `smk8_` | `POST /api/refcodes/track` | http |
| `referral.cron_mint.http` | `smoke-refcodes-http` | `smk8_` | `GET /api/cron/refcodes-mint` 401/200 + `CRON_SECRET` | http |
| `matcher.notify` | `smoke-growth-pipelines` | `smk4_` | `notifyMatchedUsers` / `matchAndNotifyUsers` (partial; may warn) | service |

### Platform core

| Pipeline ID | Suite | Prefix | Entry / flow | Layer |
|-------------|-------|--------|--------------|-------|
| `wallet.credit.spend` | `smoke-platform-pipelines` | `smk2_` | `UserCreditService` add / spend / overspend guard | service |
| `notifications.crud` | `smoke-platform-pipelines` | `smk2_` | create → list → read → stats | service |
| `messaging.send` | `smoke-platform-pipelines` | `smk2_` | `MessageService.sendMessage` row persist | service |
| `usernames.cleanup` | `smoke-platform-pipelines` | `smk2_` | `cleanupExpiredUsernameReservations` (service) | service |
| `entities.db` | `smoke-platform-pipelines` | `smk2_` | raw `entities` create + query | service |
| `entities.moderation.visibility` | `smoke-entity-moderation-pipeline` | `smk10_` | `filterEntitiesForDiscovery` / global + per-user block gates | service |
| `entities.moderation.report` | `smoke-entity-moderation-pipeline` | `smk10_` | `entity_reports` row + `reportCount` / `moderationStatus=reported` (DB contract) | service |
| `entities.moderation.user_block` | `smoke-entity-moderation-pipeline` | `smk10_` | `users.blockedEntityIds` + `getUserBlockedEntityIds` | service |
| `entities.moderation.admin_block` | `smoke-entity-moderation-pipeline` | `smk10_` | global `moderationStatus=blocked` + discovery hide | service |
| `entities.moderation.matcher_event` | `smoke-entity-moderation-pipeline` | `smk10_` | `notifyMatcherEntityModeration` → `matcher_moderation_events` | service |
| `matcher.notify.block_suppress` | `smoke-entity-moderation-pipeline` | `smk10_` | `blockedEntityIds` precondition + baseline notify; full `organizationId` path needs auth harness (tsx) | service |
| `opportunities.my.lifecycle` | — (manual / page) | — | `getMyOpportunities(view)` draft→pending→active→archived filters; delete archived-only guard; optional LLM auto-approve (`matcher.autoApprove`) pending→active on create | service |
| `webhook.signature_reject` | `smoke-webhook-probe`, `smoke-membership-pipeline` | `smk5_` / `smk7_` | invalid HMAC → dispatch fails closed | dispatch |
| `webhook.unknown_reference` | `smoke-webhook-probe` | `smk5_` | unknown `orderReference` → `success: false` | dispatch |

---

## Pipeline flow reference

### Store paid order (covered by `store_order.wfp.e2e` + `store_order.credit.e2e`)

```
checkout / webhook / credit
  → paymentTransactionService.markPaid
  → StoreOrdersService (status paid)
  → ERPStockService.deductStockForOrder
  → VendorSettlementService.processSettlements
      → recordSettlementsForPaidOrder → settlements
  → ReferralRewardService.onOrderPaid (when attributed)
```

### News promotion (covered by `news_promotion.*`)

```
submit (NOT smoked) → payment_pending
  → WFP Approved webhook
  → handleNewsWayForPayWebhook / dispatchWayForPayWebhook
  → article awaiting_admin_approval + ledger paid
```

### Membership upgrade (covered by `membership_upgrade.wfp.*`)

```
/membership pay (NOT smoked) → WFP Approved
  → dispatchWayForPayWebhook → processSuccessfulPayment
  → upgradeUserRole + ledger paid
  → ReferralRewardService.onMembershipPaid (when referredBy)
```

### ERP due payouts (covered by `settlement.due_payout_batch`)

```
admin Process due payouts / cron
  → processDueSettlements
  → payout_batches + settlements.status=completed
  → SETTLEMENT_PAYOUT_MODE=simulated → metadata.simulated
```

---

## Suite → pipeline index

| Script | Prefix | Pipeline IDs |
|--------|--------|--------------|
| `smoke-erp-referral-pipeline.cts` | `smk_` | refcode.*, referral.*, settlement.record_paid_order, erp.sales_assists |
| `smoke-platform-pipelines.cts` | `smk2_` | payment.tx.ledger, store.order.crud, wallet.credit.spend, notifications.crud, usernames.cleanup, messaging.send, entities.db |
| `smoke-commerce-pipelines.cts` | `smk3_` | vendor.lifecycle, inventory.reservations |
| `smoke-growth-pipelines.cts` | `smk4_` | referral.signup_attribution, referral.visit_track, matcher.notify, news_promotion.wfp.handler, wallet.topup.replay_guard |
| `smoke-webhook-probe.cts` | `smk5_` | webhook.*, news_promotion.wfp.dispatch, news_promotion.wfp.http |
| `smoke-store-checkout-pipeline.cts` | `smk6_` | store_order.wfp.e2e, store_order.credit.e2e, erp.stock.deduct_on_paid |
| `smoke-membership-pipeline.cts` | `smk7_` | membership_upgrade.wfp.* |
| `smoke-refcodes-http.cts` | `smk8_` | referral.track.http, referral.cron_mint.http, referral.visit_track |
| `smoke-erp-ops.cts` | `smk9_` | settlement.due_payout_batch |
| `smoke-entity-moderation-pipeline.cts` | `smk10_` | entities.moderation.*, matcher.notify.block_suppress |

---

## TODO — uncovered pipelines (backlog)

Items below are **not** in `run-all-smokes.sh`. Suggested suite names follow `smoke10_*` / domain grouping from codebase audit (2026-06-10).

### P0 — payment rails & checkout gaps

- [ ] **`stripe.news_promotion`** — `dispatchStripeWebhook` / `POST /api/payments/stripe/webhook` → `smoke-stripe-news-pipeline.cts`
- [ ] **`store.checkout.http`** — `POST /api/store/checkout` reservation + referral cookie → `smoke-store-checkout-http.cts`
- [ ] **`store.wfp.init`** — `POST /api/store/payments/wayforpay` pending tx + redirect → `smoke-store-wfp-init.cts`
- [ ] **`store_order.credit.referral`** — credit route `ReferralRewardService.onOrderPaid` (gap vs service-only credit smoke) → extend `smoke-store-checkout-pipeline.cts` §2b
- [ ] **`membership_upgrade.credit`** — `POST /api/membership/payment/credit` (needs session harness) → `smoke-membership-ring-pipeline.cts`
- [ ] **`wallet.topup.full`** — `POST /api/wallet/credit/topup` verify + balance credit → `smoke-wallet-topup-pipeline.cts`

### P1 — news, opportunities, entities

- [ ] **`news.promo.submit`** — `POST /api/news/promotion/submit` score → payment_pending → `smoke-news-promotion-submit.cts`
- [ ] **`news.telegram.approval`** — `POST /api/telegram/admin-bot/webhook` callbacks → `smoke-news-telegram-approval.cts`
- [ ] **`news.editor.crud`** — `saveArticle` / `publishArticle` / bulk → `smoke-news-save.cts`
- [ ] **`opportunities.create_match`** — `createOpportunity` → autofill → findMatches → notify → `smoke-opportunities-crud.cts`
- [ ] **`opportunities.my.lifecycle`** — create `pending` on submit, `draft` on save, archive toggle, delete archived-only; auto-approve branch: toggle OFF → stays `pending`, toggle ON + LLM high-score match → `active`, baseline fallback → stays `pending` → `smoke-opportunities-lifecycle.cts`
- [ ] **`entities.api.crud`** — `POST /api/entities/create` validated path → `smoke-entities-pipeline.cts`
- [ ] **`entities.moderation.auth_actions`** — `reportEntity` / `blockEntityForUser` / `adminBlockEntity` with session harness → extend `smoke-entity-moderation-pipeline.cts`
- [ ] **`entities.moderation.admin_queue`** — `getEntityModerationQueue` + `POST /api/admin/entity-moderation/block` (needs admin session) → `smoke-entity-moderation-http.cts`
- [ ] **`confidential.access`** — confidential opportunities/entities role gates → `smoke-confidential-access.cts`

### P1 — admin, cron HTTP, email CRM

- [ ] **`admin.referral.approve`** — `approveReferralReward` → mint queue → `smoke10_admin_referral_reward`
- [ ] **`admin.order.fulfillment`** — `POST /api/admin/orders/[id]/status` shipped/completed → `smoke10_admin_order_status`
- [ ] **`admin.stock.init`** — `initializeWarehouseStock` / `POST /api/erp/stock/initialize` → `smoke10_admin_stock_ops`
- [ ] **`cron.http.batch`** — `cleanup-usernames`, `cleanup-reservations`, `email-processor`, `train` + `CRON_SECRET` → `smoke-cron-http.cts`
- [ ] **`email.crm.inbound`** — `EmailProcessor` poll → draft → approve/send → `smoke10_email_inbound_pipeline`
- [ ] **`email.crm.threads`** — threads/tasks/contacts admin APIs → `smoke10_email_threads`

### P2 — auth, wallet, MCP, realtime

- [ ] **`auth.signin.referral`** — `auth.ts` `events.signIn` + `ring_ref` cookie (distinct from direct `persistSignupReferralAttribution`) → `smoke10_auth_signin_referral`
- [ ] **`auth.wallet.provision`** — `ensureWallet` on OAuth sign-in → `smoke10_auth_ensure_wallet`
- [ ] **`auth.crypto.wallet`** — `generateNonce` + wallet-connect funnel → `smoke-auth-wallet.cts`
- [ ] **`mcp.gateway.credit`** — `/api/mcp/v1/credit/*` + `RING_MCP_SERVICE_TOKENS` → `smoke10_mcp_credit`
- [ ] **`mcp.gateway.store`** — `/api/mcp/v1/store/**` → `smoke10_mcp_store`
- [ ] **`tunnel.transport`** — `/api/tunnel/{token,sse,publish}` → `smoke-tunnel-transport.cts`
- [ ] **`fcm.register_push`** — `/api/notifications/fcm/register` → `smoke-fcm-pipeline.cts`
- [ ] **`conversations.api`** — `/api/conversations/**` typing/read/upload → `smoke-conversations-api.cts`

### P2 — vendor portal, editor, misc

- [ ] **`vendor.portal.products`** — vendor product CRUD pages + APIs → `smoke-vendor-portal.cts`
- [ ] **`publications.editor`** — `/api/publications` + versions → `smoke-publications-pipeline.cts`
- [ ] **`nft.marketplace`** — listing draft → activate → `smoke-nft-marketplace.cts`
- [ ] **`images.generate`** — `POST /api/images/generate` → `smoke-images-pipeline.cts`
- [ ] **`shipping.novapost`** — Nova Post cities/warehouses lookup → `smoke-shipping-novapost.cts`
- [ ] **`analytics.ingest`** — `/api/analytics/*` web-vitals/navigation → `smoke-analytics-ingest.cts`

### Harness notes (for TODO suites)

| Requirement | Suites affected |
|-------------|-----------------|
| `SMOKE_BASE_URL` + running `next dev` | HTTP probes (cron, track, webhook, checkout) |
| `CRON_SECRET` | cron HTTP batch |
| `RING_MCP_SERVICE_TOKENS` | MCP gateway smokes |
| Auth session / test user cookie | membership credit, admin actions, checkout HTTP |
| `STRIPE_WEBHOOK_SECRET` + signed fixture | Stripe news pipeline |

---

## Maintenance

When adding a pipeline smoke:

1. Assign next prefix (`smk10_`, …) and register in [`run-all-smokes.sh`](./run-all-smokes.sh).
2. Add row to **Covered pipelines** and **Suite → pipeline index** above.
3. Remove or mark done the matching **TODO** item.
4. Update [`docs/content/SMOKE-GAPS.md`](../docs/content/SMOKE-GAPS.md) coverage table.
5. Document gotchas in [`SMOKE-TESTS.md`](./SMOKE-TESTS.md) if new (order-ref underscores, WFP signers, etc.).

