'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { StoreOrdersService } from '@/features/store/services/orders-service'

/**
 * Server action to update order status (admin only).
 * Only accessible by authenticated platform admins.
 */
export async function updateOrderStatus(formData: FormData) {
  try {
    // Step 1: Authenticate user
    const session = await auth()
    if (!session?.user) {
      // No session or user found, must be authenticated
      throw new Error('Authentication required')
    }

    // Step 2: Check if current user is a platform admin
    if (!isPlatformAdmin(session.user.role)) {
      // User is authenticated but lacks admin privileges
      throw new Error('Admin access required')
    }

    // Step 3: Extract and validate form data for order update
    const orderId = formData.get('orderId') as string
    const status = formData.get('status') as 'new' | 'paid' | 'processing' | 'shipped' | 'completed' | 'canceled'

    // Ensure both orderId and status are present
    if (!orderId || !status) {
      throw new Error('Order ID and status are required')
    }

    // Step 4: Perform the order status update via the service layer
    console.log('AdminOrders: Updating order status', { orderId, status, adminId: session.user.id })
    await StoreOrdersService.adminUpdateOrderStatus(orderId, status)
    // SSOT: try-catch with structured return object is the established Ring Platform action pattern

    // Step 5: Revalidate the admin orders page so it's fresh for the next admin visit or navigation
    revalidatePath('/admin/store/orders')


    // Return a success response for the client or consuming function
    return { success: true, message: 'Order status updated successfully' }
  } catch (error) {
    // Log server-side error for observability/debugging
    console.error('AdminOrders: Error updating order status:', error)
    // Return a failure response including the error message
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update order status' 
    }
  }
}

/**
 * Server action to refresh orders list in the admin dashboard.
 * Only accessible by authenticated platform admins.
 */
export async function refreshOrders() {
  try {
    // Step 1: Authenticate user
    const session = await auth()
    if (!session?.user) {
      // User not authenticated
      throw new Error('Authentication required')
    }

    // Step 2: Check user role for admin permissions
    if (!isPlatformAdmin(session.user.role)) {
      throw new Error('Admin access required')
    }

    // Step 3: Invalidate/revalidate cache for the orders page
    revalidatePath('/admin/store/orders')
    // TODO: With Next.js 16 and React 19, consider incremental cache revalidation strategies if the dataset grows large.

    // Return a minimal successful response
    return { success: true }
  } catch (error) {
    // Log server-side error for observability
    console.error('AdminOrders: Error refreshing orders:', error)
    // Return detailed error on failure
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to refresh orders' 
    }
  }
}
