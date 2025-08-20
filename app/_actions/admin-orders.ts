'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { StoreOrdersService } from '@/features/store/services/orders-service'

/**
 * Server action to update order status (admin only)
 */
export async function updateOrderStatus(formData: FormData) {
  try {
    // Step 1: Authenticate and check admin role
    const session = await getServerAuthSession()
    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (session.user.role !== UserRole.ADMIN) {
      throw new Error('Admin access required')
    }

    // Step 2: Extract form data
    const orderId = formData.get('orderId') as string
    const status = formData.get('status') as 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled'

    if (!orderId || !status) {
      throw new Error('Order ID and status are required')
    }

    // Step 3: Update order status
    console.log('AdminOrders: Updating order status', { orderId, status, adminId: session.user.id })
    await StoreOrdersService.adminUpdateOrderStatus(orderId, status)

    // Step 4: Revalidate the admin orders page
    revalidatePath('/admin/store/orders')
    
    return { success: true, message: 'Order status updated successfully' }
  } catch (error) {
    console.error('AdminOrders: Error updating order status:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update order status' 
    }
  }
}

/**
 * Server action to refresh orders list
 */
export async function refreshOrders() {
  try {
    // Step 1: Authenticate and check admin role
    const session = await getServerAuthSession()
    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (session.user.role !== UserRole.ADMIN) {
      throw new Error('Admin access required')
    }

    // Step 2: Revalidate the admin orders page
    revalidatePath('/admin/store/orders')
    
    return { success: true }
  } catch (error) {
    console.error('AdminOrders: Error refreshing orders:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to refresh orders' 
    }
  }
}
