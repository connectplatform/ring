'use server'

import { UserRole } from '@/features/auth/types'
import { logger } from '@/lib/logger'
import { getDatabaseService, initializeDatabase } from '@/lib/database'

export interface UpgradePaymentMetadata {
  paymentReference: string
  paymentAmount: number
  paymentCurrency: string
  authCode: string
  cardPan?: string
}

export interface UpgradeResult {
  success: boolean
  error?: string
  newRole?: UserRole
}

/**
 * Upgrades user role after successful payment
 * Called from WayForPay webhook processing
 */
export async function upgradeUserRole(
  userId: string,
  targetRole: UserRole,
  paymentMetadata: UpgradePaymentMetadata
): Promise<UpgradeResult> {
  try {
    logger.info('Role upgrade: Starting upgrade process', {
      userId,
      targetRole,
      paymentReference: paymentMetadata.paymentReference
    })

    // Initialize and get database service
    await initializeDatabase()
    const db = getDatabaseService()

    // Fetch current user
    const userResult = await db.findById('users', userId)
    if (!userResult.success || !userResult.data) {
      logger.error('Role upgrade: User not found', { userId })
      return {
        success: false,
        error: 'User not found'
      }
    }

    const user = userResult.data.data

    // Validate upgrade is allowed
    const roleHierarchy = {
      [UserRole.VISITOR]: 0,
      [UserRole.SUBSCRIBER]: 1,
      [UserRole.MEMBER]: 2,
      [UserRole.CONFIDENTIAL]: 3,
      [UserRole.ADMIN]: 4
    }

    const currentLevel = roleHierarchy[user.role as UserRole] || 0
    const targetLevel = roleHierarchy[targetRole] || 0

    if (targetLevel <= currentLevel) {
      logger.warn('Role upgrade: Invalid upgrade attempt', {
        userId,
        currentRole: user.role,
        targetRole
      })
      return {
        success: false,
        error: 'Cannot downgrade or stay at same role'
      }
    }

    // Record payment metadata
    const paymentHistory = {
      timestamp: new Date().toISOString(),
      targetRole,
      ...paymentMetadata
    }

    // Update user role and payment history
    await db.update('users', userId, {
      role: targetRole,
      paymentHistory: [...(user.paymentHistory || []), paymentHistory],
      updatedAt: new Date()
    })

    logger.info('Role upgrade: User role upgraded successfully', {
      userId,
      previousRole: user.role,
      newRole: targetRole,
      paymentReference: paymentMetadata.paymentReference
    })

    return {
      success: true,
      newRole: targetRole
    }

  } catch (error) {
    logger.error('Role upgrade: Error upgrading user role', {
      userId,
      targetRole,
      error
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
