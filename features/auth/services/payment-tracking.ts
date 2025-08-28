// 🚀 OPTIMIZED SERVICE: Payment tracking service for membership upgrades
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { createDocument, updateDocument, getCachedDocument } from '@/lib/services/firebase-service-manager';
import { UserRole } from '@/features/auth/types';
import { logger } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export type PaymentStatus = 'initiated' | 'pending' | 'completed' | 'failed' | 'refunded' | 'expired';

export interface PaymentAttempt {
  id?: string;
  userId: string;
  orderId: string;
  targetRole: UserRole;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentTrackingResult {
  success: boolean;
  error?: string;
  paymentAttempt?: PaymentAttempt;
}

/**
 * Records a new payment attempt for membership upgrade
 * 
 * @param paymentData - The payment attempt data to record
 * @returns A promise that resolves to a PaymentTrackingResult
 */
export async function recordPaymentAttempt(paymentData: {
  userId: string;
  orderId: string;
  targetRole: UserRole;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentUrl?: string;
  metadata?: Record<string, any>;
}): Promise<PaymentTrackingResult> {
  try {
    logger.info('Payment Tracking: Recording payment attempt', {
      userId: paymentData.userId,
      orderId: paymentData.orderId,
      targetRole: paymentData.targetRole,
      amount: paymentData.amount
    });

    const now = Timestamp.now();
    const paymentAttempt: Omit<PaymentAttempt, 'id'> = {
      userId: paymentData.userId,
      orderId: paymentData.orderId,
      targetRole: paymentData.targetRole,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status,
      paymentUrl: paymentData.paymentUrl,
      createdAt: now,
      updatedAt: now,
      metadata: paymentData.metadata || {}
    };

    // Create the payment attempt document
    const docRef = await createDocument('payment_attempts', paymentAttempt);
    
    logger.info('Payment Tracking: Payment attempt recorded successfully', {
      id: docRef.id,
      orderId: paymentData.orderId
    });

    return {
      success: true,
      paymentAttempt: {
        ...paymentAttempt,
        id: docRef.id
      }
    };

  } catch (error) {
    logger.error('Payment Tracking: Error recording payment attempt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Updates the status of a payment attempt
 * 
 * @param orderId - The order ID to update
 * @param status - The new payment status
 * @param failureReason - Optional failure reason for failed payments
 * @returns A promise that resolves to a PaymentTrackingResult
 */
export async function updatePaymentStatus(
  orderId: string,
  status: PaymentStatus,
  failureReason?: string
): Promise<PaymentTrackingResult> {
  try {
    logger.info('Payment Tracking: Updating payment status', {
      orderId,
      status,
      failureReason
    });

    // First, find the payment attempt by orderId
    const paymentAttempt = await getPaymentAttemptByOrderId(orderId);
    
    if (!paymentAttempt.success || !paymentAttempt.paymentAttempt) {
      logger.error('Payment Tracking: Payment attempt not found for order', { orderId });
      return {
        success: false,
        error: 'Payment attempt not found'
      };
    }

    const updateData: Partial<PaymentAttempt> = {
      status,
      updatedAt: Timestamp.now()
    };

    // Add completion timestamp for completed payments
    if (status === 'completed') {
      updateData.completedAt = Timestamp.now();
    }

    // Add failure reason for failed payments
    if (status === 'failed' && failureReason) {
      updateData.failureReason = failureReason;
    }

    // Update the payment attempt document
    await updateDocument('payment_attempts', paymentAttempt.paymentAttempt.id!, updateData);
    
    logger.info('Payment Tracking: Payment status updated successfully', {
      orderId,
      status,
      id: paymentAttempt.paymentAttempt.id
    });

    return {
      success: true,
      paymentAttempt: {
        ...paymentAttempt.paymentAttempt,
        ...updateData
      }
    };

  } catch (error) {
    logger.error('Payment Tracking: Error updating payment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Retrieves a payment attempt by order ID
 * 
 * @param orderId - The order ID to search for
 * @returns A promise that resolves to a PaymentTrackingResult
 */
export async function getPaymentAttemptByOrderId(orderId: string): Promise<PaymentTrackingResult> {
  try {
    logger.info('Payment Tracking: Getting payment attempt by order ID', { orderId });

    // Query payment attempts collection by orderId
    const { getCachedCollectionAdvanced } = await import('@/lib/services/firebase-service-manager');
    
    const queryResult = await getCachedCollectionAdvanced('payment_attempts', {
      where: [{ field: 'orderId', operator: '==', value: orderId }]
    });

    if (!queryResult.docs || queryResult.docs.length === 0) {
      logger.warn('Payment Tracking: No payment attempt found for order', { orderId });
      return {
        success: false,
        error: 'Payment attempt not found'
      };
    }

    const doc = queryResult.docs[0];
    const paymentAttempt: PaymentAttempt = {
      id: doc.id,
      ...doc.data()
    } as PaymentAttempt;

    logger.info('Payment Tracking: Payment attempt retrieved successfully', {
      orderId,
      id: paymentAttempt.id,
      status: paymentAttempt.status
    });

    return {
      success: true,
      paymentAttempt
    };

  } catch (error) {
    logger.error('Payment Tracking: Error getting payment attempt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Retrieves all payment attempts for a user
 * 
 * @param userId - The user ID to get payment attempts for
 * @returns A promise that resolves to an array of PaymentAttempt objects
 */
export async function getUserPaymentAttempts(userId: string): Promise<PaymentAttempt[]> {
  try {
    logger.info('Payment Tracking: Getting user payment attempts', { userId });

    const { getCachedCollectionAdvanced } = await import('@/lib/services/firebase-service-manager');
    
    const queryResult = await getCachedCollectionAdvanced('payment_attempts', {
      where: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }]
    });

    const paymentAttempts: PaymentAttempt[] = queryResult.docs?.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PaymentAttempt)) || [];

    logger.info('Payment Tracking: Retrieved user payment attempts', {
      userId,
      count: paymentAttempts.length
    });

    return paymentAttempts;

  } catch (error) {
    logger.error('Payment Tracking: Error getting user payment attempts:', error);
    return [];
  }
}

/**
 * Cleans up expired payment attempts (older than 24 hours and still pending)
 * This function should be called periodically by a cron job or similar
 * 
 * @returns A promise that resolves to the number of cleaned up attempts
 */
export async function cleanupExpiredPaymentAttempts(): Promise<number> {
  try {
    logger.info('Payment Tracking: Starting cleanup of expired payment attempts');

    const { getCachedCollectionAdvanced } = await import('@/lib/services/firebase-service-manager');
    
    // Get payment attempts that are older than 24 hours and still pending/initiated
    const twentyFourHoursAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    const queryResult = await getCachedCollectionAdvanced('payment_attempts', {
      where: [
        { field: 'status', operator: 'in', value: ['initiated', 'pending'] },
        { field: 'createdAt', operator: '<', value: twentyFourHoursAgo }
      ]
    });

    const expiredAttempts = queryResult.docs || [];
    let cleanedCount = 0;

    for (const doc of expiredAttempts) {
      try {
        await updateDocument('payment_attempts', doc.id, {
          status: 'expired' as PaymentStatus,
          updatedAt: Timestamp.now(),
          failureReason: 'Payment attempt expired after 24 hours'
        });
        cleanedCount++;
      } catch (updateError) {
        logger.warn('Payment Tracking: Failed to update expired payment attempt', {
          id: doc.id,
          error: updateError
        });
      }
    }

    logger.info('Payment Tracking: Cleanup completed', {
      totalExpired: expiredAttempts.length,
      cleanedCount
    });

    return cleanedCount;

  } catch (error) {
    logger.error('Payment Tracking: Error during cleanup:', error);
    return 0;
  }
}
