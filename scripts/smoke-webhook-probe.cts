/**
 * E2E smoke: PaymentConductor webhook dispatch + optional HTTP probe.
 *
 * Exercises dispatchWayForPayWebhook with signed payloads (news_promotion).
 * When SMOKE_BASE_URL is set (e.g. http://localhost:3000), also POSTs to the
 * canonical /api/payments/wayforpay/webhook route.
 *
 * Usage:
 *   WAYFORPAY_SECRET_KEY=test_secret \
 *   NODE_OPTIONS="--conditions=react-server" \
 *   npx tsx scripts/smoke-webhook-probe.cts [--keep]
 *
 * Optional HTTP layer:
 *   SMOKE_BASE_URL=http://localhost:3000 npx tsx scripts/smoke-webhook-probe.cts
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { signGenericWayForPayPayload } from './lib/wayforpay-test-sign'

const KEEP = process.argv.includes('--keep')
const SMOKE_SECRET = process.env.WAYFORPAY_SECRET_KEY || 'smoke_wayforpay_secret'
const ARTICLE_ID = 'smk5_article'

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

async function cleanup() {
  const db = getDatabaseService()
  try {
    await db.delete('news', ARTICLE_ID)
  } catch {
    /* may not exist */
  }
  try {
    const audits = await db.query({
      collection: 'news_submission_audit',
      filters: [{ field: 'newsId', operator: '=', value: ARTICLE_ID }],
      pagination: { limit: 20 },
    })
    for (const row of audits.success && audits.data ? audits.data : []) {
      await db.delete('news_submission_audit', row.id as string)
    }
  } catch {
    /* best effort */
  }
  try {
    const txs = await db.query({
      collection: 'payment_transactions',
      filters: [{ field: 'entity_id', operator: '=', value: ARTICLE_ID }],
      pagination: { limit: 20 },
    })
    for (const row of txs.success && txs.data ? txs.data : []) {
      await db.delete('payment_transactions', row.id as string)
    }
  } catch {
    /* best effort */
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  await db.create(
    'news',
    {
      title: 'Webhook Probe Article',
      slug: 'webhook-probe-article',
      content: 'Webhook smoke',
      mainPageStatus: 'payment_pending',
      status: 'draft',
      createdAt: now,
    },
    { id: ARTICLE_ID },
  )
}

async function main() {
  console.log('🔬 Webhook probe smoke — PaymentConductor dispatch\n')

  process.env.WAYFORPAY_SECRET_KEY = SMOKE_SECRET
  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  const orderReference = buildOrderReference('news_promotion', { articleId: ARTICLE_ID })
  await paymentTransactionService.createPending({
    purpose: 'news_promotion',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference,
    entityType: 'news',
    entityId: ARTICLE_ID,
    amountMinor: 10000,
    currency: 'UAH',
  })

  // ── 1. Invalid signature rejected ─────────────────────────────────────────
  console.log('1) Signature verification')
  const badDispatch = await dispatchWayForPayWebhook({
    orderReference,
    transactionStatus: 'Approved',
    amount: 100,
    currency: 'UAH',
    merchantSignature: 'deadbeef',
  })
  ok('invalid signature rejected', badDispatch.success === false && badDispatch.error === 'Invalid signature')

  // ── 2. Signed news_promotion dispatch ─────────────────────────────────────
  console.log('2) Signed news_promotion dispatch')
  const basePayload = {
    merchantAccount: 'smoke_merchant',
    orderReference,
    amount: 100,
    currency: 'UAH',
    authCode: '111111',
    cardPan: '411111****1111',
    transactionStatus: 'Approved',
    reasonCode: 1100,
  }
  const signed = signGenericWayForPayPayload(basePayload, SMOKE_SECRET)
  const dispatch = await dispatchWayForPayWebhook(signed)
  ok('dispatch success', dispatch.success === true, JSON.stringify(dispatch))
  ok('purpose news_promotion', dispatch.purpose === 'news_promotion')

  const article = await db.read('news', ARTICLE_ID)
  const articleData = (article.data?.data || article.data || {}) as Record<string, any>
  ok(
    'article promoted to awaiting_admin_approval',
    articleData.mainPageStatus === 'awaiting_admin_approval',
    `status=${articleData.mainPageStatus}`,
  )

  const ledger = await paymentTransactionService.findByOrderReference(orderReference)
  ok('ledger status paid', ledger?.status === 'paid')

  const dupDispatch = await dispatchWayForPayWebhook(signed)
  ok('duplicate webhook still succeeds (idempotent)', dupDispatch.success === true)

  // ── 3. Unknown order reference ────────────────────────────────────────────
  console.log('3) Unknown order reference')
  const unknownRef = signGenericWayForPayPayload(
    {
      ...basePayload,
      orderReference: 'unknown-prefix-xyz-123',
    },
    SMOKE_SECRET,
  )
  const unknown = await dispatchWayForPayWebhook(unknownRef)
  ok('unknown order reference fails closed', unknown.success === false)

  // ── 4. Optional HTTP probe ────────────────────────────────────────────────
  console.log('4) HTTP probe (optional)')
  const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    warning('HTTP probe skipped', 'set SMOKE_BASE_URL to exercise live route handler')
  } else {
    const httpArticle = 'smk5_http_article'
    const httpRef = buildOrderReference('news_promotion', { articleId: httpArticle })
    await db.create(
      'news',
      {
        title: 'HTTP Probe Article',
        slug: 'http-probe-article',
        mainPageStatus: 'payment_pending',
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
      { id: httpArticle },
    )
    await paymentTransactionService.createPending({
      purpose: 'news_promotion',
      processor: 'wayforpay',
      rail: 'fiat',
      orderReference: httpRef,
      entityType: 'news',
      entityId: httpArticle,
      amountMinor: 10000,
      currency: 'UAH',
    })

    const httpPayload = signGenericWayForPayPayload(
      { ...basePayload, orderReference: httpRef },
      SMOKE_SECRET,
    )

    try {
      const res = await fetch(`${baseUrl}/api/payments/wayforpay/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(httpPayload),
      })
      ok('HTTP POST /api/payments/wayforpay/webhook → 200', res.status === 200, `status=${res.status}`)
      const body = (await res.json()) as Record<string, unknown>
      ok('HTTP response status accept', body.status === 'accept')

      if (!KEEP) {
        await db.delete('news', httpArticle)
        const txs = await db.query({
          collection: 'payment_transactions',
          filters: [{ field: 'order_reference', operator: '=', value: httpRef }],
          pagination: { limit: 5 },
        })
        for (const row of txs.success && txs.data ? txs.data : []) {
          await db.delete('payment_transactions', row.id as string)
        }
      }
    } catch (e) {
      fail++
      console.log(`  ❌ HTTP probe failed — ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── 5. GET health on route (when base URL set) ────────────────────────────
  if (baseUrl) {
    try {
      const health = await fetch(`${baseUrl}/api/payments/wayforpay/webhook`)
      const healthJson = (await health.json()) as Record<string, unknown>
      ok('GET webhook health', health.ok && healthJson.service === 'wayforpay-webhook')
    } catch (e) {
      warning('GET health probe', e instanceof Error ? e.message : String(e))
    }
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
