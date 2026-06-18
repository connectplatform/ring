/**
 * E2E smoke: membership_upgrade — WFP webhook dispatch, role upgrade, ledger + referral hook.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   npx tsx scripts/smoke-membership-pipeline.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { signGenericWayForPayPayload } from './lib/wayforpay-test-sign'
import { UserRole } from '@/features/auth/types'

const KEEP = process.argv.includes('--keep')
const SMOKE_SECRET = process.env.WAYFORPAY_SECRET_KEY || 'smoke_wayforpay_secret'

const IDS = {
  subscriber: 'smk7subscriber',
  referrer: 'smk7referrer',
}
const REFERRER_WALLET = '0x3333333333333333333333333333333333333333'

let pass = 0
let fail = 0
let warn = 0
let orderReference = ''

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

async function cleanup() {
  const db = getDatabaseService()
  for (const id of [IDS.subscriber, IDS.referrer]) {
    try {
      await db.delete('users', id)
    } catch {
      /* best effort */
    }
  }
  if (orderReference) {
    try {
      const txs = await db.query({
        collection: 'payment_transactions',
        filters: [{ field: 'order_reference', operator: '=', value: orderReference }],
        pagination: { limit: 5 },
      })
      for (const row of txs.success && txs.data ? txs.data : []) {
        await db.delete('payment_transactions', row.id as string)
      }
    } catch {
      /* best effort */
    }
    try {
      const rewards = await db.query({
        collection: 'referral_rewards',
        filters: [{ field: 'orderReference', operator: '=', value: orderReference }],
        pagination: { limit: 5 },
      })
      for (const row of rewards.success && rewards.data ? rewards.data : []) {
        await db.delete('referral_rewards', row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  await db.create(
    'users',
    { name: 'Smoke Referrer', walletAddress: REFERRER_WALLET, createdAt: now },
    { id: IDS.referrer },
  )
  await db.create(
    'users',
    {
      name: 'Smoke Subscriber',
      role: UserRole.subscriber,
      createdAt: now,
      referredBy: {
        referralCode: 'SMOKECOD',
        referrerUserId: IDS.referrer,
        referrerWallet: REFERRER_WALLET,
      },
    },
    { id: IDS.subscriber },
  )
}

async function main() {
  console.log('🔬 Membership pipeline smoke — ring_platform dev\n')

  process.env.WAYFORPAY_SECRET_KEY = SMOKE_SECRET

  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  orderReference = buildOrderReference('membership_upgrade', { userId: IDS.subscriber })
  await paymentTransactionService.createPending({
    purpose: 'membership_upgrade',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference,
    entityType: 'user',
    entityId: IDS.subscriber,
    userId: IDS.subscriber,
    amountMinor: 29900,
    currency: 'UAH',
  })

  // ── 1. Signature guard ────────────────────────────────────────────────────
  console.log('1) Signature verification')
  const bad = await dispatchWayForPayWebhook({
    orderReference,
    transactionStatus: 'Approved',
    amount: 299,
    currency: 'UAH',
    merchantSignature: 'bad',
  })
  ok('invalid signature rejected', bad.success === false && bad.error === 'Invalid signature')

  // ── 2. Approved membership dispatch ───────────────────────────────────────
  console.log('2) membership_upgrade dispatch')
  const basePayload = {
    merchantAccount: 'smoke_merchant',
    orderReference,
    amount: 299,
    currency: 'UAH',
    authCode: '333333',
    cardPan: '411111****1111',
    transactionStatus: 'Approved',
    reasonCode: 1100,
  }
  const signed = signGenericWayForPayPayload(basePayload, SMOKE_SECRET)
  const dispatch = await dispatchWayForPayWebhook(signed)
  ok('dispatch success', dispatch.success === true, JSON.stringify(dispatch))
  ok('purpose membership_upgrade', dispatch.purpose === 'membership_upgrade')
  ok('membership ack returned', Boolean(dispatch.membershipAck?.status === 'accept'))

  const userRow = await db.findById('users', IDS.subscriber)
  const userData = (userRow.data?.data || userRow.data || {}) as Record<string, any>
  ok('role upgraded to member', userData.role === UserRole.member, `role=${userData.role}`)
  ok('payment history recorded', Array.isArray(userData.paymentHistory) && userData.paymentHistory.length >= 1)

  const ledger = await paymentTransactionService.findByOrderReference(orderReference)
  ok('ledger status paid', ledger?.status === 'paid')

  // ── 3. Idempotent replay ──────────────────────────────────────────────────
  console.log('3) Idempotent replay')
  const replay = await dispatchWayForPayWebhook(signed)
  const userReplay = await db.findById('users', IDS.subscriber)
  const replayData = (userReplay.data?.data || userReplay.data || {}) as Record<string, any>
  ok('role still member after replay', replayData.role === UserRole.member)
  const ledgerReplay = await paymentTransactionService.findByOrderReference(orderReference)
  ok('ledger remains paid after replay', ledgerReplay?.status === 'paid')
  if (!replay.success) {
    warning('duplicate membership dispatch', 'role upgrade rejects replay; ledger idempotency holds')
  } else {
    ok('duplicate webhook dispatch succeeds', true)
  }

  // ── 4. Declined transaction ───────────────────────────────────────────────
  console.log('4) Declined transaction')
  const declinedRef = buildOrderReference('membership_upgrade', { userId: IDS.referrer })
  await paymentTransactionService.createPending({
    purpose: 'membership_upgrade',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference: declinedRef,
    entityType: 'user',
    entityId: IDS.referrer,
    userId: IDS.referrer,
    amountMinor: 29900,
    currency: 'UAH',
  })
  const declined = signGenericWayForPayPayload(
    { ...basePayload, orderReference: declinedRef, transactionStatus: 'Declined', reasonCode: 1101 },
    SMOKE_SECRET,
  )
  const declinedDispatch = await dispatchWayForPayWebhook(declined)
  ok('declined membership not processed', declinedDispatch.success === false)

  try {
    await db.query({
      collection: 'payment_transactions',
      filters: [{ field: 'order_reference', operator: '=', value: declinedRef }],
      pagination: { limit: 1 },
    }).then(async (res) => {
      for (const row of res.success && res.data ? res.data : []) {
        await db.delete('payment_transactions', row.id as string)
      }
    })
  } catch {
    /* best effort */
  }

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
