#!/usr/bin/env bash
# Install refcodes module from ring-platform.org (canonical) into a Ring clone.
#
# Usage:
#   ./scripts/install-refcodes-module.sh /path/to/ring-connect-software
#   ./scripts/install-refcodes-module.sh /path/to/ring-ringdom-org
#   ./scripts/install-refcodes-module.sh /path/to/clone --dry-run
#
# After copy + migration, apply SHARED FILE PATCHES printed at the end (line anchors).
set -euo pipefail

CANON="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?Usage: $0 <clone-root> [--dry-run]}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

if [[ ! -d "$TARGET/features/store" ]]; then
  echo "ERROR: $TARGET does not look like a Ring clone (missing features/store)"
  exit 1
fi

copy_tree() {
  local src="$1" dst="$2"
  if $DRY_RUN; then
    echo "[dry-run] cp -R $src → $dst"
  else
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
    echo "copied: $dst"
  fi
}

copy_file() {
  local src="$1" dst="$2"
  if $DRY_RUN; then
    echo "[dry-run] cp $src → $dst"
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "copied: $dst"
  fi
}

echo "=== Refcodes module install: $CANON → $TARGET ==="

# --- New directories / files (copy verbatim) ---
copy_tree "$CANON/features/refcodes" "$TARGET/features/refcodes"
copy_file "$CANON/features/store/lib/referral-commission.ts" "$TARGET/features/store/lib/referral-commission.ts"
copy_file "$CANON/features/store/lib/merchant-config.ts" "$TARGET/features/store/lib/merchant-config.ts"
copy_file "$CANON/lib/web3/server-wallet.ts" "$TARGET/lib/web3/server-wallet.ts"
copy_tree "$CANON/app/(authenticated)/[locale]/refcodes" "$TARGET/app/(authenticated)/[locale]/refcodes"
copy_tree "$CANON/app/(admin)/[locale]/admin/refcodes" "$TARGET/app/(admin)/[locale]/admin/refcodes"
copy_tree "$CANON/app/api/refcodes" "$TARGET/app/api/refcodes"
copy_file "$CANON/app/_actions/admin-refcodes.ts" "$TARGET/app/_actions/admin-refcodes.ts"
copy_file "$CANON/locales/en/modules/refcodes.json" "$TARGET/locales/en/modules/refcodes.json"
copy_file "$CANON/locales/uk/modules/refcodes.json" "$TARGET/locales/uk/modules/refcodes.json"
copy_file "$CANON/locales/ru/modules/refcodes.json" "$TARGET/locales/ru/modules/refcodes.json"
copy_file "$CANON/data/migrations/005_refcodes_schema.sql" "$TARGET/data/migrations/005_refcodes_schema.sql"
copy_file "$CANON/data/migrations/007_settlements_schema.sql" "$TARGET/data/migrations/007_settlements_schema.sql"

# --- ERP settlement pipeline + surfaces (2026-06 campaigns) ---
copy_file "$CANON/features/store/constants/collections.ts" "$TARGET/features/store/constants/collections.ts"
copy_file "$CANON/features/store/services/settlement.ts" "$TARGET/features/store/services/settlement.ts"
copy_file "$CANON/features/store/services/settlement-pipeline.ts" "$TARGET/features/store/services/settlement-pipeline.ts"
copy_file "$CANON/features/store/services/vendor-settlement.ts" "$TARGET/features/store/services/vendor-settlement.ts"
copy_file "$CANON/app/_actions/admin-store-erp.ts" "$TARGET/app/_actions/admin-store-erp.ts"
copy_tree "$CANON/app/(admin)/[locale]/admin/store" "$TARGET/app/(admin)/[locale]/admin/store"
copy_tree "$CANON/app/(authenticated)/[locale]/vendor/orders" "$TARGET/app/(authenticated)/[locale]/vendor/orders"
copy_tree "$CANON/app/(authenticated)/[locale]/vendor/earnings" "$TARGET/app/(authenticated)/[locale]/vendor/earnings"
copy_tree "$CANON/app/(authenticated)/[locale]/vendor/settings" "$TARGET/app/(authenticated)/[locale]/vendor/settings"
copy_tree "$CANON/app/(authenticated)/[locale]/vendor/stock" "$TARGET/app/(authenticated)/[locale]/vendor/stock"
copy_tree "$CANON/app/api/vendor/status" "$TARGET/app/api/vendor/status"
copy_tree "$CANON/app/api/cron/refcodes-mint" "$TARGET/app/api/cron/refcodes-mint"
copy_tree "$CANON/components/refcodes" "$TARGET/components/refcodes"
copy_tree "$CANON/docs/en/features/erp" "$TARGET/docs/en/features/erp"
copy_file "$CANON/REFERRAL-ONCHAIN-OPS.md" "$TARGET/REFERRAL-ONCHAIN-OPS.md"

# Contracts (optional but recommended for deploy)
if [[ -d "$CANON/contracts/contracts-src" ]]; then
  copy_tree "$CANON/contracts/contracts-src" "$TARGET/contracts/contracts-src"
  copy_file "$CANON/contracts/hardhat.config.js" "$TARGET/contracts/hardhat.config.js"
  copy_file "$CANON/contracts/package.json" "$TARGET/contracts/package.json"
  copy_file "$CANON/contracts/scripts/deploy-referral-rewards.js" "$TARGET/contracts/scripts/deploy-referral-rewards.js"
  copy_file "$CANON/contracts/test/ReferralRewards.test.js" "$TARGET/contracts/test/ReferralRewards.test.js"
fi

# --- Database migrations (005 refcodes + 007 settlements) ---
if ! $DRY_RUN; then
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -f "$TARGET/data/migrations/005_refcodes_schema.sql"
    psql "$DATABASE_URL" -f "$TARGET/data/migrations/007_settlements_schema.sql"
    echo "OK: migrations 005 + 007 applied via DATABASE_URL"
  else
    echo "WARN: DATABASE_URL not set — run migrations manually:"
    echo "  psql \"\$DATABASE_URL\" -f data/migrations/005_refcodes_schema.sql"
    echo "  psql \"\$DATABASE_URL\" -f data/migrations/007_settlements_schema.sql"
  fi
fi

cat <<'PATCHES'

================================================================================
SHARED FILE PATCHES (manual — merge if Reggie/propagate skipped a hunk)
================================================================================

1) proxy.ts
   AFTER line importing from '@/lib/proxy-intl' (last import in that block), ADD:
     import { REF_COOKIE_MAX_AGE_SECONDS, REF_COOKIE_NAME } from '@/features/refcodes/constants'

   REPLACE the block that ends with `return finalizeIntlResponse(...)` before the catch:
     const response = finalizeIntlResponse(req, intlReq, i18nResponse)
     const refParam = intlReq.nextUrl.searchParams.get('ref')?.trim()
     if (refParam && !intlReq.cookies.get(REF_COOKIE_NAME)?.value) {
       response.cookies.set(REF_COOKIE_NAME, refParam, {
         maxAge: REF_COOKIE_MAX_AGE_SECONDS,
         path: '/',
         sameSite: 'lax',
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
       })
     }
     return response

2) constants/routes.ts — inside BASE_ROUTES object, AFTER WALLET_CONNECT line ADD:
     REFCODES: '/refcodes',
     ADMIN_REFCODES: '/admin/refcodes',

3) constants/web3.ts — AFTER RING_SALES_ADDRESS block ADD:
     export const REFERRAL_REWARDS_ADDRESS =
       process.env.REFERRAL_REWARDS_ADDRESS || '0x0000000000000000000000000000000000000000'
     export const REFERRAL_REWARD_TOKEN_ADDRESS =
       process.env.REFERRAL_REWARD_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000'

4) i18n/shared.ts — add pathnames (near other /wallet routes):
     '/refcodes': '/refcodes',
     '/admin/refcodes': '/admin/refcodes',

5) lib/i18n/message-scopes.ts
   a) Add 'modRefcodes' to LocaleFileId union (after modNotifications)
   b) Add 'modRefcodes' to AUTHENTICATED_EXTRA array
   c) Add 'modRefcodes' to ADMIN_EXTRA array
   d) Add 'modRefcodes' to ALL_FILES array

6) lib/i18n.ts — in importLocaleFile switch, BEFORE case 'vendor': ADD:
     case 'modRefcodes':
       return import(`@/locales/${targetLocale}/modules/refcodes.json`)
         .then((m) => m.default)
         .catch(() => ({}))

   In mergeModules (or equivalent), ensure:
     if (loaded.modRefcodes) modules.refcodes = loaded.modRefcodes

7) features/store/types.ts — on StoreOrder interface ADD:
     referralCode?: string
     referrerUserId?: string
     referrerWallet?: string

8) features/store/services/orders-service.ts — change createOrder signature to:
     async createOrder(
       userId: string,
       data: z.infer<typeof orderCreateSchema>,
       referral?: { referralCode?: string; referrerUserId?: string; referrerWallet?: string }
     )
   Spread referral fields into orderData when present.

9) app/api/store/orders/route.ts — ADD imports:
     import { REF_COOKIE_NAME } from '@/features/refcodes/constants'
     import { getBuyerWalletAddresses, resolveOrderReferral } from '@/features/refcodes/services/attribution-service'
   In POST handler before createOrder:
     const refCode = req.cookies.get(REF_COOKIE_NAME)?.value
     const buyerWallets = await getBuyerWalletAddresses(session.user.id)
     const referral = await resolveOrderReferral(session.user.id, refCode, buyerWallets)
     const { orderId } = await StoreOrdersService.createOrder(session.user.id, parsed.data, referral || undefined)
     return NextResponse.json({ orderId, referralApplied: Boolean(referral) })

10) features/store/services/settlement.ts — replace flat 5% referral with:
     import from features/store/lib/referral-commission.ts
     loadProductsForOrderItems + computeWeightedReferralCommissionFromOrderItems in calculateCommission

11) features/refcodes/services/referral-reward-service.ts — use computeWeightedReferralPercentFromCart;
     persist rewardPercent on ReferralRewardRecord (see canonical file)

12) lib/payments/conductor/handlers/store-order.ts
    ADD import:
      import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
    Inside Approved + isNew block, AFTER settlement try/catch, ADD:
      if (order) {
        try {
          await ReferralRewardService.onOrderPaid({
            order: order as StoreOrder,
            orderReference,
            rail: 'fiat',
          })
        } catch (referralError) {
          logger.error('Store webhook: referral reward failed', { orderId, referralError })
        }
      }

13) app/api/store/payments/credit/route.ts
    ADD imports for ReferralRewardService + StoreOrder; after adminUpdateOrderStatus('paid'):
      const paidOrder = (await StoreOrdersService.getOrderWithPaymentDetails(body.orderId)) as StoreOrder | null
      if (paidOrder && result.orderReference) {
        await ReferralRewardService.onOrderPaid({
          order: paidOrder,
          orderReference: result.orderReference,
          rail: 'credit',
        })
      }

14) locales/*/navigation.json — add nav label keys: `refcodes`, `sidebar.referralRewards`
    (match your clone's pattern).

15) .reggie-propagate-exclude.json — exclude per-clone secrets:
      "REFERRAL_MINTER_PRIVATE_KEY", "REFERRAL_REWARDS_ADDRESS", "REFERRAL_REWARD_TOKEN_ADDRESS",
      "CRON_SECRET", "SETTLEMENT_PAYOUT_PRIVATE_KEY", "SETTLEMENT_PAYOUT_TOKEN_ADDRESS"

16) lib/database/adapters/PostgreSQLAdapter.ts — buildWhereClause MUST accept the
    SQL-style '=' operator (alias of '==') and '<>' (alias of '!='). Without this,
    every db.query({ operator: '=' }) silently returns empty (refcodes, settlements,
    attribution all break). Verify:
      case '==':
      case '=':
        conditions.push(`${fieldRef} = $${paramIndex}`);

17) lib/payments/conductor/handlers/membership-upgrade.ts — after successful upgrade:
      await ReferralRewardService.onMembershipPaid({ userId, orderReference, amount, currency })

18) Signup attribution — on isNewUser sign-in, persist ring_ref cookie attribution
    to users.data.referredBy (see auth signup flow in canonical repo).

19) Checkout badge — features/store/components/checkout/review-step.tsx renders
    <ReferralCheckoutBadge /> from components/refcodes (reads ring_ref_visible cookie).
    proxy.ts must also set the ring_ref_visible mirror cookie (non-httpOnly).

20) Navigation surfaces:
    - components/navigation/desktop-sidebar.tsx: "Share & Earn" item (auth-gated),
      admin "Referral rewards" + "Store & ERP" shortcuts, vendor group via /api/vendor/status
    - features/layout/components/mobile-menu.tsx: Wallet + Share & Earn user links
    - components/wrappers/admin-wrapper.tsx: refcodes + store entries in adminSections

21) i18n shared files:
    - lib/i18n/message-scopes.ts / lib/i18n.ts: modRefcodes wiring (items 5-6 above)
    - locales/*/modules/admin.json: storeHub.* block (tabs, stock, commissions,
      ordersPage, simulatedBadge)
    - locales/*/vendor.json: orders/earnings/settings/stock blocks + dashboard
      quick-actions + earnings.simulatedBadge

22) docs/en/features/meta.json — add "erp"; docs nav tree must
    support one nested meta.json level (components/docs/docs-navigation-tree.tsx).

23) env.local.template — append blocks: REFERRAL CODES MODULE, CRON_SECRET,
    ERP SETTLEMENT PAYOUTS (SETTLEMENT_PAYOUT_MODE=simulated default).

================================================================================
.env / k8s secrets — REQUIRED per clone (never commit private keys)
================================================================================

REFERRAL_MINTER_PRIVATE_KEY=0x...     # server operator wallet; must match OPERATOR_ROLE on contract
REFERRAL_MINTER_ADDRESS=0x...         # optional; deploy script operator fallback
REFERRAL_REWARDS_ADDRESS=0x...       # UUPS proxy from deploy-referral-rewards.js
REFERRAL_REWARD_TOKEN_ADDRESS=0x...    # mintable ERC20 on target chain
REFERRAL_REWARD_PERCENT=5             # % of order value → token reward
REFERRAL_CHAIN_ID=137                 # Polygon mainnet default
REFERRAL_UAH_PER_USD=40               # fiat conversion for reward sizing
REFERRAL_REWARD_MODE=0                # 0=MINT, 1=TRANSFER
POLYGON_RPC_URL=https://polygon-rpc.com
DEPLOYER_PRIVATE_KEY=0x...            # contracts deploy only (not app runtime)

Optional public (if token address exposed to client):
NEXT_PUBLIC_RING_TOKEN_ADDRESS=0x...  # fallback for REFERRAL_REWARD_TOKEN_ADDRESS

================================================================================
Grant token minter to ReferralRewards proxy (REFERRAL_REWARD_MODE=0 / MINT)
================================================================================

ReferralRewards calls IMintableERC20.mint() — the TOKEN must authorize the proxy.

A) Ownable mint (MockMintableToken / simple owner-only mint):
   token.transferOwnership(REFERRAL_REWARDS_PROXY_ADDRESS)

B) OpenZeppelin AccessControl MINTER_ROLE on token:
   const MINTER_ROLE = await token.MINTER_ROLE()
   await token.grantRole(MINTER_ROLE, REFERRAL_REWARDS_PROXY_ADDRESS)

C) Custom Ring token: grant whatever role/permission your token uses for mint.

Verify:
  - REFERRAL_MINTER_PRIVATE_KEY address has OPERATOR_ROLE on ReferralRewards (set at initialize)
  - Proxy is not paused
  - rewardToken on contract matches REFERRAL_REWARD_TOKEN_ADDRESS env

Hardhat deploy (from contracts/):
  rm -rf node_modules package-lock.json
  npm install
  REFERRAL_REWARD_TOKEN_ADDRESS=0x... REFERRAL_MINTER_ADDRESS=0x... REFERRAL_REWARD_MODE=0 \
    npx hardhat run scripts/deploy-referral-rewards.js --network polygon

Note: package.json uses @openzeppelin/hardhat-upgrades ^3.5 + toolbox ^5 (ethers v6).
      If you see ERESOLVE with upgrades ^1.28 / toolbox ^3, delete node_modules and package-lock.json.

PATCHES

echo "=== Install complete. Apply SHARED FILE PATCHES above, then set .env and grant minter role. ==="
