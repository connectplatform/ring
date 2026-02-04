'use server'

import { UserRole } from '@/features/auth/types'
import { logger } from '@/lib/logger'
import { getDatabaseService, initializeDatabase } from '@/lib/database'

export type PaymentStatus = 'initiated' | 'completed' | 'failed' | 'cancelled'

export interface PaymentAttempt {
  orderId: string
  userId: string
  targetRole: UserRole
  amount: number
  currency: string
  status: PaymentStatus
  paymentUrl?: string
  failureReason?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Records a payment attempt in the database
 */
export async function recordPaymentAttempt(data: {
  userId: string
  orderId: string
  targetRole: UserRole
  amount: number
  currency: string
  status: PaymentStatus
  paymentUrl?: string
}): Promise<void> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const paymentAttempt: PaymentAttempt = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Store in payments collection
    await db.create('payments', paymentAttempt, { id: data.orderId })

    logger.info('Payment tracking: Recorded payment attempt', {
      orderId: data.orderId,
      userId: data.userId,
      status: data.status
    })

  } catch (error) {
    logger.error('Payment tracking: Error recording payment attempt', {
      orderId: data.orderId,
      error
    })
    throw error
  }
}

/**
 * Updates payment status
 */
export async function updatePaymentStatus(
  orderId: string,
  status: PaymentStatus,
  failureReason?: string
): Promise<void> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()

    await db.update('payments', orderId, {
      status,
      failureReason,
      updatedAt: new Date()
    })

    logger.info('Payment tracking: Updated payment status', {
      orderId,
      status,
      failureReason
    })

  } catch (error) {
    logger.error('Payment tracking: Error updating payment status', {
      orderId,
      status,
      error
    })
    throw error
  }
}

/**
 * Gets payment attempt by order ID
 */
export async function getPaymentAttempt(orderId: string): Promise<PaymentAttempt | null> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    const result = await db.findById('payments', orderId)
    
    if (!result.success || !result.data) {
      return null
    }
    
    return result.data.data as PaymentAttempt

  } catch (error) {
    logger.error('Payment tracking: Error getting payment attempt', {
      orderId,
      error
    })
    return null
  }
}

/**
 * Gets all payment attempts for a user
 */
export async function getUserPaymentHistory(userId: string): Promise<PaymentAttempt[]> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const result = await db.findByField('payments', 'userId', userId, {
      orderBy: { field: 'createdAt', direction: 'desc' }
    })

    if (!result.success || !result.data) {
      return []
    }

    return result.data.map(doc => doc.data as PaymentAttempt)

  } catch (error) {
    logger.error('Payment tracking: Error getting user payment history', {
      userId,
      error
    })
    return []
  }
}
