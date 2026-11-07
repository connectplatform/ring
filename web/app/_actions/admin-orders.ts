'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import {
  releaseReservationsForOrder,
  restoreStockForOrder,
} from '@/features/store/services/inventory-sync'
import { logger } from '@/lib/logger'

/**
 * Server action to update order status (admin only).
 * Only accessible by authenticated platform admins.
 */
export async function updateOrderStatus(formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (!isPlatformAdmin(session.user.role)) {
      throw new Error('Admin access required')
    }

    const orderId = formData.get('orderId') as string
    const status = formData.get('status') as
      | 'new'
      | 'paid'
      | 'processing'
      | 'shipped'
      | 'completed'
      | 'canceled'

    if (!orderId || !status) {
      throw new Error('Order ID and status are required')
    }

    const prior = await StoreOrdersService.getOrderWithPaymentDetails(orderId)
    const wasPaid =
      prior?.payment?.status === 'paid' ||
      prior?.status === 'paid' ||
      prior?.status === 'processing' ||
      prior?.status === 'shipped' ||
      prior?.status === 'completed'

    logger.info('AdminOrders: Updating order status', {
      orderId,
      status,
      adminId: session.user.id,
    })
    if (status === 'shipped') {
      const { ensureNovaPostShipment } = await import('@/lib/shipping/nova-post-shipment')
      await ensureNovaPostShipment(orderId)
    }
    await StoreOrdersService.adminUpdateOrderStatus(orderId, status)

    if (status === 'canceled') {
      try {
        if (wasPaid) {
          await restoreStockForOrder(orderId)
        } else {
          await releaseReservationsForOrder(orderId)
        }
      } catch (inventoryError) {
        logger.error('AdminOrders: inventory reverse failed on cancel', {
          orderId,
          inventoryError,
        })
      }
    }

    revalidatePath('/admin/store/orders')
    revalidatePath('/admin/store/stock')

    return { success: true, message: 'Order status updated successfully' }
  } catch (error) {
    console.error('AdminOrders: Error updating order status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order status',
    }
  }
}

/**
 * Server action to refresh orders list in the admin dashboard.
 * Only accessible by authenticated platform admins.
 */
export async function refreshOrders() {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (!isPlatformAdmin(session.user.role)) {
      throw new Error('Admin access required')
    }

    revalidatePath('/admin/store/orders')

    return { success: true }
  } catch (error) {
    console.error('AdminOrders: Error refreshing orders:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh orders',
    }
  }
}

/**
 * Load the next admin orders page (offset pagination; plain DTO for RSC/client).
 */
export async function refreshOrderTracking(orderId: string) {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    throw new Error('Admin access required')
  }
  const { refreshNovaPostTracking } = await import('@/lib/shipping/nova-post-shipment')
  const shipments = await refreshNovaPostTracking(orderId)
  revalidatePath('/admin/store/orders')
  return { success: true, shipments }
}

export async function loadMoreAdminOrders(input: {
  offset: number
  limit?: number
  statusFilter?: string
}) {
  try {
    const session = await auth()
    if (!session?.user) {
      throw new Error('Authentication required')
    }
    if (!isPlatformAdmin(session.user.role)) {
      throw new Error('Admin access required')
    }

    const statusFilter =
      input.statusFilter === 'new' ||
      input.statusFilter === 'paid' ||
      input.statusFilter === 'processing' ||
      input.statusFilter === 'shipped' ||
      input.statusFilter === 'completed' ||
      input.statusFilter === 'canceled'
        ? input.statusFilter
        : undefined

    const { toAdminOrderDto, ADMIN_LIST_PAGE_SIZE } = await import('@/lib/admin/admin-list-dto')
    const limit = Math.min(Math.max(input.limit ?? ADMIN_LIST_PAGE_SIZE, 1), 100)
    const offset = Math.max(input.offset ?? 0, 0)

    const result = await StoreOrdersService.adminListAllOrders({
      limit,
      offset,
      statusFilter,
    })

    const { withReturnableQuantities } = await import('@/lib/admin/order-returnable')
    const mapped = result.items.map((row) =>
      toAdminOrderDto(row as Record<string, unknown> & { id: string }),
    )
    const items = await withReturnableQuantities(mapped)

    return {
      success: true as const,
      items,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      lastVisible: result.lastVisible,
    }
  } catch (error) {
    console.error('AdminOrders: Error loading more orders:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load orders',
      items: [],
      hasMore: false,
      nextOffset: input.offset ?? 0,
      lastVisible: null,
    }
  }
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    throw new Error('Admin access required')
  }
  return session
}

export async function resolveOrderSettlementAction(orderId: string) {
  const session = await requireAdmin()
  const { db } = await import('@/lib/database')
  const order = await db().findDocById<Record<string, unknown>>('orders', orderId)
  if (!order.success || !order.data) throw new Error('Order not found')
  const shipping = (order.data.shippingInfo || {}) as Record<string, unknown>
  const location = (shipping.location || {}) as Record<string, unknown>
  const divisionId = String(location.id || location.externalId || '')
  if (!divisionId) return { resolved: false as const }
  const { getNovaPostDivision, novaPostApiKey } = await import('@/lib/shipping/nova-post')
  const apiKey = novaPostApiKey()
  if (!apiKey) throw new Error('Nova Post API key is not configured')
  const division = await getNovaPostDivision(apiKey, divisionId)
  if (!division?.settlementId) return { resolved: false as const }
  await db().updateDoc('orders', orderId, {
    shippingInfo: {
      ...shipping,
      location: {
        ...location,
        id: division.divisionId,
        settlementId: division.settlementId,
        name: location.name || division.name,
        address: location.address || division.address,
      },
    },
    updatedAt: new Date().toISOString(),
  })
  revalidatePath('/admin/store/orders')
  logger.info('AdminOrders: settlement resolved from division', { orderId, adminId: session.user.id })
  return { resolved: true as const, settlementId: division.settlementId }
}

export async function saveOrderNovaPostLocationAction(input: {
  orderId: string
  id: string
  name: string
  address: string
  settlementId: string
  settlementName?: string
}) {
  await requireAdmin()
  if (!input.id.trim() || !input.settlementId.trim()) {
    throw new Error('Choose a city and a branch')
  }
  const { db } = await import('@/lib/database')
  const order = await db().findDocById<Record<string, unknown>>('orders', input.orderId)
  if (!order.success || !order.data) throw new Error('Order not found')
  const shipping = (order.data.shippingInfo || {}) as Record<string, unknown>
  await db().updateDoc('orders', input.orderId, {
    shippingInfo: {
      ...shipping,
      method: shipping.method || 'nova-post',
      location: {
        id: input.id.trim(),
        externalId: input.id.trim(),
        name: input.name,
        address: input.address,
        settlementId: input.settlementId.trim(),
        settlementName: input.settlementName || '',
      },
    },
    updatedAt: new Date().toISOString(),
  })
  revalidatePath('/admin/store/orders')
  return { success: true }
}

export async function confirmOrderParcelAction(input: {
  orderId: string
  warehouseId: string
  weight: number
  length: number
  width: number
  height: number
}) {
  const session = await requireAdmin()
  const weight = Number(input.weight)
  const length = Number(input.length)
  const width = Number(input.width)
  const height = Number(input.height)
  const warehouseId = input.warehouseId.trim()
  if (!warehouseId) throw new Error('Choose the fulfilling warehouse')
  if (![weight, length, width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Weight and size must be numbers greater than zero')
  }
  const { db } = await import('@/lib/database')
  const { shipmentDocumentMap } = await import('@/features/store/services/fulfillment-ledger')
  await db().transaction(async (transaction) => {
    const fresh = await transaction.read('orders', input.orderId)
    const order = (fresh?.data || {}) as Record<string, unknown>
    const map = shipmentDocumentMap(order)
    const current = (map[warehouseId] || {}) as Record<string, unknown>
    map[warehouseId] = {
      ...current,
      warehouseId,
      parcel: {
        weight,
        length,
        width,
        height,
        source: 'confirmed',
        confirmedBy: session.user.id,
        confirmedAt: new Date().toISOString(),
      },
    }
    await transaction.update('orders', input.orderId, { shipments: map })
  })
  revalidatePath('/admin/store/orders')
  return { success: true }
}

export async function restockReturnedLineAction(input: {
  orderId: string
  productId: string
  warehouseId?: string
  quantity: number
  mode: 'resellable' | 'damaged'
  idempotencyKey: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
  const session = await requireAdmin()
  const { db } = await import('@/lib/database')
  const { readOrderShipments } = await import('@/features/store/services/fulfillment-ledger')
  const { ZERO_WAREHOUSE_ID } = await import('@/features/store/constants/stock')
  const order = await db().findDocById<Record<string, unknown>>('orders', input.orderId)
  if (!order.success || !order.data) throw new Error('Order not found')
  const records = readOrderShipments(order.data)
  const warehouseId = input.warehouseId || ''
  const shipment = warehouseId
    ? records.find((record) => record.warehouseId === warehouseId && record.number)
    : records.find((record) => record.number)
  if (!shipment?.number) throw new Error('This order has no shipment to return')
  const sales = await db().queryDocs<Record<string, unknown> & { id: string }>({
    collection: 'stock_movements',
    filters: [
      { field: 'orderId', operator: '=', value: input.orderId },
      { field: 'movementType', operator: '=', value: 'sale' },
    ],
    pagination: { limit: 50 },
  })
  const rows = sales.success && sales.data ? sales.data : []
  const matches = rows.filter((row) => String(row.productId || '') === input.productId)
  const sale = warehouseId
    ? matches.find((row) => String(row.warehouseId || ZERO_WAREHOUSE_ID) === warehouseId)
    : matches[0]
  if (!sale) throw new Error('Sale movement not found')
  const { restoreSaleQuantity } = await import('@/features/store/services/inventory-sync')
  await restoreSaleQuantity({
    saleMovementId: sale.id,
    quantity: input.quantity,
    userId: session.user.id,
    idempotencyKey: input.idempotencyKey,
    mode: input.mode,
  })
  revalidatePath('/admin/store/orders')
  revalidatePath('/admin/store/stock')
  return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Return failed',
    }
  }
}

export async function clearShipmentIntentAction(orderId: string, warehouseId: string) {
  await requireAdmin()
  const warehouse = warehouseId.trim()
  if (!warehouse) throw new Error('Choose the fulfilling warehouse')
  const { db } = await import('@/lib/database')
  const { readOrderShipments, shipmentDocumentMap } = await import('@/features/store/services/fulfillment-ledger')
  const order = await db().findDocById<Record<string, unknown>>('orders', orderId)
  if (!order.success || !order.data) throw new Error('Order not found')
  const record = readOrderShipments(order.data).find((row) => row.warehouseId === warehouse)
  if (record?.number) throw new Error('This order already has a shipment number')
  if (record?.intent?.status !== 'pending') return { success: true }
  await db().transaction(async (transaction) => {
    const fresh = await transaction.read('orders', orderId)
    const locked = (fresh?.data || {}) as Record<string, unknown>
    const current = readOrderShipments(locked).find((row) => row.warehouseId === warehouse)
    if (current?.number) throw new Error('This order already has a shipment number')
    if (current?.intent?.status !== 'pending') return
    const map = shipmentDocumentMap(locked)
    const row = (map[warehouse] || {}) as Record<string, unknown>
    map[warehouse] = {
      ...row,
      warehouseId: warehouse,
      intent: { status: 'failed', at: new Date().toISOString(), reconciled: true },
    }
    await transaction.update('orders', orderId, { shipments: map })
  })
  revalidatePath('/admin/store/orders')
  return { success: true }
}

export async function refreshOwnOrderTracking(orderId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Authentication required')
  const { StoreOrdersService } = await import('@/features/store/services/orders-service')
  const order = await StoreOrdersService.getOrderById(orderId)
  if (!order) throw new Error('Order not found')
  if (order.userId !== session.user.id && !isPlatformAdmin(session.user.role)) {
    throw new Error('Order not found')
  }
  const { refreshNovaPostTracking } = await import('@/lib/shipping/nova-post-shipment')
  const shipments = await refreshNovaPostTracking(orderId)
  revalidatePath(`/store/orders/${orderId}`)
  return {
    success: true,
    number: shipments[0]?.number,
    status: shipments[0]?.status,
    numbers: shipments.map((row) => row.number).filter((value): value is string => Boolean(value)),
  }
}
