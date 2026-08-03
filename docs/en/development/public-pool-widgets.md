# Public pool widget families

Canonical companion for **community jars** (`public_pools`, `public_pool_signals`, `public_pool_contributions`). Dual-audience product SSOT: **[Public Pools & DAO Jars](/docs/features/public-pools)** (updated 2026-07-21).

Each Ring **clone** (`ring-config.json` → `clone.name` / `getPublicPoolConfig().cloneId`) owns its own jars. Product routes: `/[locale]/dao` (not `/pools`).

## Shared contract

| Collection | Purpose |
|------------|---------|
| `public_pools` | Jar metadata, goals, denormalized totals, status |
| `public_pool_signals` | 1 active like per member per pool (v1) |
| `public_pool_contributions` | Chip-ins (native SPL and card rails) with idempotency |

### future_feature (implemented)

- **Scope:** Docs backlog `<FutureFeatureWidget />` items
- **Pricing:** 1 machine-hour = 1 RING; minimum goal = 1 RING (config: `publicPools`)
- **Queue gate:** 100 likes **OR** 100% native pledged
- **Native chip-in:** Solana SPL → clone treasury (**donation mode — live**)
- **Card/PayPal chip-in:** `POST /api/public-pools/[slug]/card-checkout` → PaymentPurpose `public_pool_contribution` → desk oracle FX (`nativeUi = fiatMajor / nativePerMainCurrency`) — **not** 1:1 fiat↔RING
- **Builder payout:** On ≥100% funding + `autoPayoutOnGoalMet`, treasury pays **net** (pledged − `platformFeePercentByRole`) to builder primary Solana wallet
- **Escrow:** Anchor program `solana/programs/public-pool` (init/contribute/finalize/refund). Gated by `NEXT_PUBLIC_PUBLIC_POOL_PROGRAM_ID`. **Not production-wired** until deploy + IDL client
- **API:** `/api/public-pools`, `/signal`, `/contribute`, `/contribute/confirm`, `/[slug]/card-checkout`
- **Share to chat:** `ShareToChatButton` / `PostDaoJarToChatButton` → `share_card` / `dao_jar`
- **Chat jar:** `Message.type = dao_jar`; refresh via `refreshOpenDaoJarMessages` after totals change
- **CTA:** `PoolContributePanel` — fiat currency for card/PayPal; native symbol for chip-in; credit + native balances

**Not Ring jar SSOT:** WayForPay Донати, Stripe `submit_type=donate`, PayPal Donate SDK.

### city_dao / class_action / mutual_aid / governance_signal (planned)

See FutureFeature widgets on [Public Pools & DAO Jars](/docs/features/public-pools). Taxonomy sketch remains in git history of this file; do not treat subtypes as shipped.

## Status machine

```
open → queued → in_progress → completed
              ↘ cancelled
```

- **`queued`:** 100 likes or 100% pledged (future_feature rules)
- **`completed`:** freezes `signal_at_completion`; may trigger builder payout (donation accounting path)

## Admin

`POST /api/admin/public-pools/[id]/status` — platform admin status transitions.

## Escrow (partial)

Program source: `solana/programs/public-pool/src/lib.rs`. Gate: `features/public-pools/lib/public-pool-escrow-gate.ts`. Do **not** claim escrow contribute is live in production.
