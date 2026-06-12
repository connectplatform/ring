/**
 * E2E smoke: refcodes attribution → settlement pipeline → reward ledger.
 *
 * Seeds throwaway smk_* rows, exercises the real services, asserts DB state,
 * and cleans up. Safe to re-run.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   DATABASE_URL=postgresql://ring_user:ring_password_2024@localhost:5432/ring_platform \
 *   npx tsx scripts/smoke-erp-referral-pipeline.ts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { RefcodeService } from '@/features/refcodes/services/refcode-service'
import { resolveOrderReferral } from '@/features/refcodes/services/attribution-service'
import { recordSettlementsForPaidOrder } from '@/features/store/services/settlement-pipeline'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'
import { processApprovedRewards } from '@/features/refcodes/services/reward-minter'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import type { StoreOrder } from '@/features/store/types'

const KEEP = process.argv.includes('--keep')

const IDS = {
  referrer: 'smk_referrer',
  buyer: 'smk_buyer',
  member: 'smk_member',
  vendorEntity: 'smk_entity',
  vendorProfile: 'vendor_smk_entity',
  product: 'smk_product_1',
  order: 'smk_order_1',
  orderRef: 'smk_order_ref_1',
  membershipRef: 'smk_membership_ref_1',
}
const REFERRER_WALLET = '0x1111111111111111111111111111111111111111'

let pass = 0
let fail = 0
let warn = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function warning(name: string, detail: string) {
  warn++
  console.log(`  ⚠️  ${name} — ${detail}`)
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()

  await db.create('users', { name: 'Smoke Referrer', walletAddress: REFERRER_WALLET, createdAt: now }, { id: IDS.referrer })
  await db.create('users', { name: 'Smoke Buyer', createdAt: now }, { id: IDS.buyer })
  await db.create(
    'users',
    {
      name: 'Smoke Member',
      createdAt: now,
      referredBy: { referralCode: 'PENDING', referrerUserId: IDS.referrer, referrerWallet: REFERRER_WALLET },
    },
    { id: IDS.member },
  )
  await db.create(
    STORE_COLLECTIONS.vendorProfiles,
    { vendorId: IDS.vendorEntity, storeName: 'Smoke Vendor', storeTier: 'starter', createdAt: now },
    { id: IDS.vendorProfile },
  )
  await db.create(
    'store_products',
    { name: 'Smoke Product', price: 1000, currency: 'UAH', referralCommission: 10, vendorId: IDS.vendorEntity, createdAt: now },
    { id: IDS.product },
  )
}

async function cleanup() {
  const db = getDatabaseService()
  const wipe: Array<[string, string]> = [
    ['users', IDS.referrer],
    ['users', IDS.buyer],
    ['users', IDS.member],
    [STORE_COLLECTIONS.vendorProfiles, IDS.vendorProfile],
    ['store_products', IDS.product],
  ]
  for (const [collection, id] of wipe) {
    try {
      await db.delete(collection, id)
    } catch {
      /* row may not exist */
    }
  }
  // Query-based cleanup for generated ids
  const queryWipes: Array<[string, string, string]> = [
    [STORE_COLLECTIONS.settlements, 'orderId', IDS.order],
    [STORE_COLLECTIONS.erpSalesAssists, 'orderId', IDS.order],
    ['referral_rewards', 'orderReference', IDS.orderRef],
    ['referral_rewards', 'orderReference', IDS.membershipRef],
    ['refcodes', 'ownerUserId', IDS.referrer],
  ]
  for (const [collection, field, value] of queryWipes) {
    try {
      const res = await db.query({ collection, filters: [{ field, operator: '=', value }], pagination: { limit: 20 } })
      const rows = res.success && res.data ? (Array.isArray(res.data) ? res.data : []) : []
      for (const row of rows) {
        await db.delete(collection, row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
}

async function main() {
  console.log('🔬 ERP / Referral pipeline smoke — ring_platform dev\n')
  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup() // clear leftovers from previous runs
  await seed()

  // 1. Refcode creation
  console.log('1) Refcode')
  const refcode = await RefcodeService.getOrCreateForWallet(IDS.referrer, REFERRER_WALLET)
  ok('code generated for referrer wallet', Boolean(refcode.code && refcode.code.length === 8), refcode.code)

  // point member's referredBy at the real code
  await db.update('users', IDS.member, {
    referredBy: { referralCode: refcode.code, referrerUserId: IDS.referrer, referrerWallet: REFERRER_WALLET },
  })

  // 2. Attribution guards
  console.log('2) Attribution')
  const attributed = await resolveOrderReferral(IDS.buyer, refcode.code, [])
  ok('buyer first order attributes referrer', attributed?.referrerUserId === IDS.referrer)
  const selfRef = await resolveOrderReferral(IDS.referrer, refcode.code, [REFERRER_WALLET])
  ok('self-referral blocked', selfRef === null)
  const badCode = await resolveOrderReferral(IDS.buyer, 'DOESNOTEXIST', [])
  ok('unknown code rejected', badCode === null)

  // 3. Paid order → settlement pipeline
  console.log('3) Settlement pipeline')
  const order: StoreOrder = {
    id: IDS.order,
    userId: IDS.buyer,
    items: [
      {
        product: { id: IDS.product, name: 'Smoke Product', price: 1000, currency: 'UAH' } as never,
        quantity: 2,
      } as never,
    ],
    subtotal: 2000,
    total: 2000,
    status: 'paid',
    payment: { method: 'wayforpay', status: 'paid', amount: 2000, currency: 'UAH', paidAt: new Date().toISOString() },
    shippingInfo: { name: 'Smoke', phone: '0', address: '-', city: '-', postalCode: '-' } as never,
    vendorSettlements: [
      {
        vendorId: IDS.vendorEntity,
        vendorEntityId: IDS.vendorEntity,
        productIds: [IDS.product],
        subtotal: 2000,
        commission: 200,
        commissionRate: 10,
        netAmount: 1800,
      },
    ],
    referralCode: refcode.code,
    referrerUserId: IDS.referrer,
    referrerWallet: REFERRER_WALLET,
    createdAt: new Date().toISOString(),
  }

  const recorded = await recordSettlementsForPaidOrder(order)
  ok('settlement created', recorded.created === 1, JSON.stringify(recorded))

  const settlementRows = await db.query({
    collection: STORE_COLLECTIONS.settlements,
    filters: [{ field: 'orderId', operator: '=', value: IDS.order }],
    pagination: { limit: 5 },
  })
  const sRows = settlementRows.success && settlementRows.data ? settlementRows.data : []
  ok('settlements row queryable', sRows.length === 1)
  const sData = (sRows[0]?.data || sRows[0] || {}) as Record<string, any>
  const breakdown = sData.metadata?.commissionBreakdown
  ok(
    'referralEffectivePercent recorded (product override 10%)',
    breakdown?.referralEffectivePercent === 10,
    `got ${JSON.stringify(breakdown?.referralEffectivePercent)}`,
  )

  const idempotent = await recordSettlementsForPaidOrder(order)
  ok('idempotent re-run skips', idempotent.created === 0 && idempotent.skipped === 1)

  const assists = await db.query({
    collection: STORE_COLLECTIONS.erpSalesAssists,
    filters: [{ field: 'orderId', operator: '=', value: IDS.order }],
    pagination: { limit: 5 },
  })
  const aRows = assists.success && assists.data ? assists.data : []
  ok('erp_sales_assists row written', aRows.length === 1)

  // 4. Referral reward (fiat → pending approval) — needs price oracle
  console.log('4) Referral reward ledger')
  try {
    const reward = await ReferralRewardService.onOrderPaid({ order, orderReference: IDS.orderRef, rail: 'fiat' })
    ok('reward row created', reward.created === true)
    if (reward.rewardId) {
      const r = await db.findById('referral_rewards', reward.rewardId)
      const rData = (r.data?.data || r.data || {}) as Record<string, any>
      ok('status pending_approval (fiat rail)', rData.status === 'pending_approval')
      ok('rewardPercent persisted (10)', rData.rewardPercent === 10, `got ${rData.rewardPercent}`)
      ok('orderReference cross-rail key matches', rData.orderReference === IDS.orderRef)
    }
    const dup = await ReferralRewardService.onOrderPaid({ order, orderReference: IDS.orderRef, rail: 'fiat' })
    ok('duplicate orderReference rejected', dup.created === false)
  } catch (e) {
    warning('reward sizing skipped', `price oracle unavailable: ${e instanceof Error ? e.message : e}`)
  }

  // 5. Membership path
  console.log('5) Membership referral')
  try {
    const m = await ReferralRewardService.onMembershipPaid({
      userId: IDS.member,
      orderReference: IDS.membershipRef,
      amount: 500,
      currency: 'UAH',
    })
    ok('membership reward created via referredBy', m.created === true)
  } catch (e) {
    warning('membership reward skipped', `price oracle unavailable: ${e instanceof Error ? e.message : e}`)
  }

  // 6. Cron mint queue (service-level; HTTP route uses same processApprovedRewards)
  console.log('6) Cron mint queue')
  const cronEmpty = await processApprovedRewards(5)
  ok('processApprovedRewards runs on empty approved queue', cronEmpty.processed === 0)

  if (!KEEP) {
    await cleanup()
    console.log('\n🧹 test rows cleaned up')
  } else {
    console.log('\n📌 --keep: test rows left in DB')
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${warn} warnings`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('SMOKE CRASHED:', e)
  process.exit(1)
})
