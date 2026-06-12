/**
 * Settlement pipeline — wires paid orders into the canonical `settlements` ledger.
 */

import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import type { Order, OrderItem, StoreOrder, VendorOrder, VendorSettlement } from '@/features/store/types'
import { FulfillmentStatus } from '@/constants/store'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import { createSettlement } from '@/features/store/services/settlement'

async function updateVendorPendingBalance(vendorId: string, amount: number): Promise<void> {
  const entityId = vendorId.replace(/^vendor_/, '')
  const profileId = `vendor_${entityId}`
  const vendorResult = await db().findDocById<Record<string, unknown>>(
    STORE_COLLECTIONS.vendorProfiles,
    profileId
  )
  if (!vendorResult.success || !vendorResult.data) return
  const currentBalance = (vendorResult.data.pendingBalance as number) || 0
  await db().updateDoc(STORE_COLLECTIONS.vendorProfiles, profileId, {
    pendingBalance: currentBalance + amount,
    lastPayoutUpdate: new Date().toISOString(),
  })
}

function vendorEntityIdFromSettlement(vs: VendorSettlement): string {
  return vs.vendorEntityId || vs.vendorId
}

function buildVendorOrderFromSettlement(
  order: StoreOrder,
  vs: VendorSettlement,
): VendorOrder {
  const entityId = vendorEntityIdFromSettlement(vs)
  const items: OrderItem[] = (order.items || [])
    .filter((item) => vs.productIds?.includes(item.product.id))
    .map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      currency: item.product.currency,
      quantity: item.quantity,
      vendorId: vs.vendorId,
      storeId: entityId,
    }))

  return {
    vendorId: entityId,
    storeId: entityId,
    items,
    subtotal: vs.subtotal,
    commission: vs.commission,
    vendorPayout: vs.netAmount,
    fulfillmentStatus: FulfillmentStatus.PENDING,
    metadata: order.referralCode ? { referralCode: order.referralCode } : undefined,
  }
}

function buildOrderForSettlement(order: StoreOrder): Order {
  const currency = order.payment?.currency?.toUpperCase()
  const totals: Order['totals'] = {}
  if (currency === 'RING') totals.RING = order.total
  else if (currency === 'DAARION') totals.DAARION = order.total
  else totals.DAAR = order.total

  return {
    id: order.id,
    userId: order.userId,
    items: (order.items || []).map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      currency: item.product.currency,
      quantity: item.quantity,
    })),
    totals,
    checkoutInfo: order.shippingInfo,
    status: order.status === 'cancelled' ? 'canceled' : (order.status as Order['status']),
    createdAt: order.createdAt,
    payment: order.payment
      ? {
          method: order.payment.method === 'wayforpay' ? 'stripe' : 'crypto',
          status: order.payment.status === 'paid' ? 'paid' : 'pending',
        }
      : undefined,
  }
}

async function settlementExistsForOrderVendor(
  orderId: string,
  vendorId: string,
): Promise<boolean> {
  const result = await db().queryDocs({
    collection: STORE_COLLECTIONS.settlements,
    filters: [
      { field: 'orderId', operator: '=', value: orderId },
      { field: 'vendorId', operator: '=', value: vendorId },
    ],
    pagination: { limit: 1 },
  })
  if (!result.success) return false
  return result.data.length > 0
}

export async function recordErpSalesAssist(params: {
  orderId: string
  vendorId: string
  referralCode: string
  referrerUserId?: string
  subtotal: number
  currency?: string
}): Promise<void> {
  const id = `assist_${params.orderId}_${params.vendorId}`
  const existing = await db().findDocById(STORE_COLLECTIONS.erpSalesAssists, id)
  if (existing.success && existing.data) return

  await db().createDoc(
    STORE_COLLECTIONS.erpSalesAssists,
    {
      orderId: params.orderId,
      vendorId: params.vendorId,
      referralCode: params.referralCode,
      referrerUserId: params.referrerUserId,
      subtotal: params.subtotal,
      currency: params.currency || 'UAH',
      assisted: true,
      createdAt: new Date().toISOString(),
    },
    { id },
  )
}

export async function recordSettlementsForPaidOrder(
  order: StoreOrder,
): Promise<{ created: number; skipped: number }> {
  if (!order.vendorSettlements?.length) {
    logger.warn('SettlementPipeline: no vendorSettlements on order', { orderId: order.id })
    return { created: 0, skipped: 0 }
  }

  const orderForSettlement = buildOrderForSettlement(order)
  let created = 0
  let skipped = 0

  for (const vs of order.vendorSettlements) {
    const vendorId = vendorEntityIdFromSettlement(vs)
    if (await settlementExistsForOrderVendor(order.id, vendorId)) {
      skipped++
      continue
    }

    const vendorOrder = buildVendorOrderFromSettlement(order, vs)
    await createSettlement(orderForSettlement, vendorOrder)
    created++

    await updateVendorPendingBalance(vendorId, vendorOrder.vendorPayout)

    if (order.referralCode) {
      try {
        await recordErpSalesAssist({
          orderId: order.id,
          vendorId,
          referralCode: order.referralCode,
          referrerUserId: order.referrerUserId,
          subtotal: vs.subtotal,
          currency: order.payment?.currency,
        })
      } catch (assistError) {
        logger.warn('SettlementPipeline: erp_sales_assists write failed', {
          orderId: order.id,
          assistError,
        })
      }
    }
  }

  logger.info('SettlementPipeline: settlements recorded', {
    orderId: order.id,
    created,
    skipped,
  })

  return { created, skipped }
}
