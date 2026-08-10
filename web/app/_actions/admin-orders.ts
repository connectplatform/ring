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

    const items = result.items.map((row) =>
      toAdminOrderDto(row as Record<string, unknown> & { id: string }),
    )

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
