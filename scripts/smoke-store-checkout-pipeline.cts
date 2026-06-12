/**
 * E2E smoke: store checkout — WFP `store_order` webhook and internal-credit paid path.
 * Exercises stock deduction, settlement ledger, and payment tx idempotency end-to-end.
 *
 * Usage:
 *   NODE_OPTIONS="--conditions=react-server" \
 *   DB_BACKEND_MODE=k8s-postgres-fcm \
 *   PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY=UAH \
 *   npx tsx scripts/smoke-store-checkout-pipeline.cts [--keep]
 */

import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { dispatchWayForPayWebhook } from '@/lib/payments/conductor/webhook-dispatcher'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { VendorSettlementService } from '@/features/store/services/vendor-settlement'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import { signStoreWayForPayPayload } from './lib/wayforpay-test-sign'
import type { StoreOrder } from '@/features/store/types'

const KEEP = process.argv.includes('--keep')
const SMOKE_SECRET = process.env.WAYFORPAY_SECRET_KEY || 'smoke_wayforpay_secret'

const IDS = {
  buyer: 'smk6_buyer',
  creditBuyer: 'smk6_credit_buyer',
  vendorEntity: 'smk6_entity',
  vendorProfile: 'vendor_smk6_entity',
  product: 'smk6_product',
  wfpOrder: 'smk6wfporder',
  creditOrder: 'smk6creditorder',
}

let pass = 0
let fail = 0
let warn = 0
let wfpOrderRef = ''

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

function vendorSettlements(subtotal: number) {
  return [
    {
      vendorId: IDS.vendorEntity,
      vendorEntityId: IDS.vendorEntity,
      productIds: [IDS.product],
      subtotal,
      commission: Math.round(subtotal * 0.1),
      commissionRate: 10,
      netAmount: Math.round(subtotal * 0.9),
    },
  ]
}

function orderItems() {
  return [
    {
      product: {
        id: IDS.product,
        name: 'Smoke Checkout Product',
        price: 500,
        currency: 'UAH',
      },
      quantity: 2,
    },
  ]
}

async function cleanup() {
  const db = getDatabaseService()
  const direct: Array<[string, string]> = [
    ['users', IDS.buyer],
    ['users', IDS.creditBuyer],
    [STORE_COLLECTIONS.vendorProfiles, IDS.vendorProfile],
    ['store_products', IDS.product],
    [STORE_COLLECTIONS.orders, IDS.wfpOrder],
    [STORE_COLLECTIONS.orders, IDS.creditOrder],
  ]
  for (const [collection, id] of direct) {
    try {
      await db.delete(collection, id)
    } catch {
      /* best effort */
    }
  }
  const queryWipes: Array<[string, string, string]> = [
    [STORE_COLLECTIONS.settlements, 'orderId', IDS.wfpOrder],
    [STORE_COLLECTIONS.settlements, 'orderId', IDS.creditOrder],
    [STORE_COLLECTIONS.erpSalesAssists, 'orderId', IDS.wfpOrder],
    [STORE_COLLECTIONS.erpSalesAssists, 'orderId', IDS.creditOrder],
    [STORE_COLLECTIONS.stockMovements, 'orderId', IDS.wfpOrder],
    [STORE_COLLECTIONS.stockMovements, 'orderId', IDS.creditOrder],
  ]
  for (const [collection, field, value] of queryWipes) {
    try {
      const res = await db.query({ collection, filters: [{ field, operator: '=', value }], pagination: { limit: 20 } })
      for (const row of res.success && res.data ? res.data : []) {
        await db.delete(collection, row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
  if (wfpOrderRef) {
    try {
      const txs = await db.query({
        collection: 'payment_transactions',
        filters: [{ field: 'order_reference', operator: '=', value: wfpOrderRef }],
        pagination: { limit: 5 },
      })
      for (const row of txs.success && txs.data ? txs.data : []) {
        await db.delete('payment_transactions', row.id as string)
      }
    } catch {
      /* best effort */
    }
  }
}

async function seed() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  await db.create('users', { name: 'Smoke WFP Buyer', createdAt: now }, { id: IDS.buyer })
  await db.create('users', { name: 'Smoke Credit Buyer', createdAt: now }, { id: IDS.creditBuyer })
  await db.create(
    STORE_COLLECTIONS.vendorProfiles,
    { vendorId: IDS.vendorEntity, storeName: 'Smoke Store Vendor', storeTier: 'starter', createdAt: now },
    { id: IDS.vendorProfile },
  )
  await db.create(
    'store_products',
    {
      name: 'Smoke Checkout Product',
      price: 500,
      currency: 'UAH',
      stock: 50,
      vendorId: IDS.vendorEntity,
      createdAt: now,
    },
    { id: IDS.product },
  )
}

async function seedWfpOrder() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  const total = 1000
  await db.create(
    STORE_COLLECTIONS.orders,
    {
      userId: IDS.buyer,
      items: orderItems(),
      subtotal: total,
      total,
      status: 'new',
      payment: { method: 'wayforpay', status: 'pending', amount: total, currency: 'UAH' },
      shippingInfo: { name: 'Smoke', phone: '0', address: '-', city: '-', postalCode: '-' },
      vendorSettlements: vendorSettlements(total),
      createdAt: now,
    },
    { id: IDS.wfpOrder },
  )
}

async function seedCreditOrder() {
  const db = getDatabaseService()
  const now = new Date().toISOString()
  const total = 800
  await db.create(
    STORE_COLLECTIONS.orders,
    {
      userId: IDS.creditBuyer,
      items: orderItems(),
      subtotal: total,
      total,
      status: 'new',
      payment: { method: 'credit', status: 'pending', amount: total, currency: 'UAH' },
      shippingInfo: { name: 'Smoke', phone: '0', address: '-', city: '-', postalCode: '-' },
      vendorSettlements: vendorSettlements(total),
      createdAt: now,
    },
    { id: IDS.creditOrder },
  )
}

async function main() {
  console.log('🔬 Store checkout pipeline smoke — ring_platform dev\n')

  process.env.WAYFORPAY_SECRET_KEY = SMOKE_SECRET
  process.env.WAYFORPAY_STORE_SECRET_KEY = SMOKE_SECRET
  process.env.PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY = process.env.PAYMENT_CREDIT_ACCEPT_ORDER_CURRENCY || 'UAH'

  await initializeDatabase()
  const db = getDatabaseService()

  await cleanup()
  await seed()

  // ── 1. WFP store_order webhook E2E ─────────────────────────────────────────
  console.log('1) WFP store_order webhook')
  await seedWfpOrder()

  wfpOrderRef = buildOrderReference('store_order', { orderId: IDS.wfpOrder })
  await paymentTransactionService.createPending({
    purpose: 'store_order',
    processor: 'wayforpay',
    rail: 'fiat',
    orderReference: wfpOrderRef,
    entityType: 'order',
    entityId: IDS.wfpOrder,
    userId: IDS.buyer,
    amountMinor: 100000,
    currency: 'UAH',
  })

  const badDispatch = await dispatchWayForPayWebhook({
    merchantAccount: 'smoke_store_merchant',
    orderReference: wfpOrderRef,
    amount: 1000,
    currency: 'UAH',
    authCode: '222222',
    cardPan: '411111****1111',
    transactionStatus: 'Approved',
    reasonCode: 1100,
    merchantSignature: 'invalid',
  })
  ok('invalid store signature rejected', badDispatch.success === false && badDispatch.error === 'Invalid signature')

  const baseStorePayload = {
    merchantAccount: 'smoke_store_merchant',
    orderReference: wfpOrderRef,
    amount: 1000,
    currency: 'UAH',
    authCode: '222222',
    cardPan: '411111****1111',
    transactionStatus: 'Approved',
    reasonCode: 1100,
  }
  const signedStore = signStoreWayForPayPayload(baseStorePayload, SMOKE_SECRET)
  const dispatch = await dispatchWayForPayWebhook(signedStore)
  ok('dispatch success', dispatch.success === true, JSON.stringify(dispatch))
  ok('purpose store_order', dispatch.purpose === 'store_order')

  const paidOrder = (await StoreOrdersService.getOrderById(IDS.wfpOrder)) as Record<string, any> | null
  ok('order status paid', paidOrder?.status === 'paid', `status=${paidOrder?.status}`)
  ok('payment status paid', paidOrder?.payment?.status === 'paid', `payment=${paidOrder?.payment?.status}`)

  const ledger = await paymentTransactionService.findByOrderReference(wfpOrderRef)
  ok('ledger status paid', ledger?.status === 'paid')

  const settlements = await db.query({
    collection: STORE_COLLECTIONS.settlements,
    filters: [{ field: 'orderId', operator: '=', value: IDS.wfpOrder }],
    pagination: { limit: 5 },
  })
  const sRows = settlements.success && settlements.data ? settlements.data : []
  ok('settlements row created via webhook path', sRows.length === 1, `count=${sRows.length}`)

  const productAfter = await db.findById('store_products', IDS.product)
  const productData = (productAfter.data?.data || productAfter.data || {}) as Record<string, any>
  ok('stock deducted (50 → 48)', productData.stock === 48, `stock=${productData.stock}`)

  const dupDispatch = await dispatchWayForPayWebhook(signedStore)
  ok('duplicate webhook idempotent', dupDispatch.success === true)
  const productDup = await db.findById('store_products', IDS.product)
  const productDupData = (productDup.data?.data || productDup.data || {}) as Record<string, any>
  ok('duplicate webhook does not double-deduct stock', productDupData.stock === 48, `stock=${productDupData.stock}`)

  // ── 2. Internal-credit checkout (service path mirrors credit route) ───────
  console.log('2) Internal-credit store checkout')
  await seedCreditOrder()

  const credit = UserCreditService.getInstance()
  await credit.initializeCreditBalance(IDS.creditBuyer)
  await credit.addCredits(IDS.creditBuyer, { amount: '2000', description: 'smoke credit' } as never, 'topup' as never, '1')

  const checkout = await PaymentConductor.createCheckout({
    purpose: 'store_order',
    rail: 'internal_credit',
    userId: IDS.creditBuyer,
    userEmail: 'credit@smoke.test',
    entityId: IDS.creditOrder,
    orderId: IDS.creditOrder,
    amount: 800,
    currency: 'UAH',
    returnUrl: '',
  })
  ok('credit checkout paid', checkout.success === true && checkout.paid === true, JSON.stringify(checkout))

  if (checkout.success && checkout.paid) {
    await StoreOrdersService.updateOrderPaymentStatus(IDS.creditOrder, {
      method: 'credit',
      status: 'paid',
      amount: 800,
      currency: 'UAH',
      paidAt: new Date().toISOString(),
    })
    await StoreOrdersService.adminUpdateOrderStatus(IDS.creditOrder, 'paid')

    const paidCreditOrder = (await StoreOrdersService.getOrderWithPaymentDetails(IDS.creditOrder)) as StoreOrder | null
    if (paidCreditOrder?.items?.length) {
      const stockResult = await ERPStockService.deductStockForOrder(
        IDS.creditOrder,
        paidCreditOrder.items,
        paidCreditOrder.userId,
      )
      ok('credit path stock deduction', stockResult.success === true, JSON.stringify(stockResult))
    }

    if (paidCreditOrder?.vendorSettlements?.length && checkout.orderReference) {
      const settlementResult = await VendorSettlementService.processSettlements(IDS.creditOrder, {
        paymentMethod: 'credit',
        transactionId: checkout.orderReference,
        amount: paidCreditOrder.total ?? 800,
        currency: 'UAH',
      })
      ok('credit path settlements processed', settlementResult.success === true)
    }
  }

  const creditSettlements = await db.query({
    collection: STORE_COLLECTIONS.settlements,
    filters: [{ field: 'orderId', operator: '=', value: IDS.creditOrder }],
    pagination: { limit: 5 },
  })
  const cRows = creditSettlements.success && creditSettlements.data ? creditSettlements.data : []
  ok('credit order settlements row', cRows.length === 1, `count=${cRows.length}`)

  const balance = await credit.getUserCreditBalance(IDS.creditBuyer)
  ok('credit balance reduced after checkout', balance?.amount === '1200', `balance=${balance?.amount}`)

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
