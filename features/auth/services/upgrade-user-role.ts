'use server'

import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { getRoleLevel } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { db } from '@/lib/database'

// Payment metadata provided from the payment processor
export interface UpgradePaymentMetadata {
  paymentReference: string              // Unique reference to the payment
  paymentAmount: number                 // Amount paid by user
  paymentCurrency: string               // Currency of the payment
  authCode: string                      // Payment authorization code
  cardPan?: string                      // (Optional) Card PAN, not always provided
}

// Result type returned from the upgradeUserRole operation
export interface UpgradeResult {
  success: boolean                      // Indicates operation result
  error?: string                        // Error, if any
  newRole?: UserRolesArray              // The new user role, if upgrade succeeded
}

/**
 * Upgrades user role after successful payment
 * Called from WayForPay webhook processing.
 * @param userId - The identifier of the user to upgrade.
 * @param targetRole - The role to upgrade the user to, must be higher than current.
 * @param paymentMetadata - Metadata about the payment transaction.
 * @returns UpgradeResult object with success state, error, and newRole if applicable.
 */
export async function upgradeUserRole(
  userId: string,
  targetRole: UserRolesArray,
  paymentMetadata: UpgradePaymentMetadata
): Promise<UpgradeResult> {
  try {
    // Log: Starting upgrade process and payment reference for audit
    logger.info('Role upgrade: Starting upgrade process', {
      userId,
      targetRole,
      paymentReference: paymentMetadata.paymentReference
    })

    // Fetch user record from database
    // TODO: If moving to React19/Next16 server actions, consider replacing with cacheable fetch calls and `revalidateTag` where possible for post-mutation consistency
    const userResult = await db().findDocById<Record<string, unknown>>('users', userId)
    // If user not found, log error and abort (guard clause)
    if (!userResult.success || !userResult.data) {
      logger.error('Role upgrade: User not found', { userId })
      return {
        success: false,
        error: 'User not found'
      }
    }

    const user = userResult.data  // Found user object

    // Validate the upgrade: targetRole must be higher than the user's current role
    const currentLevel = getRoleLevel(assertKnownUserRole(user.role as UserRolesArray))
    const wantedLevel = getRoleLevel(assertKnownUserRole(targetRole))

    // Disallow downgrades or lateral moves (only strict upgrades)
    if (wantedLevel <= currentLevel) {
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

    // Compose payment history entry to be added to user's paymentHistory
    const paymentHistoryItem = {
      timestamp: new Date().toISOString(), // ISO formatted UTC timestamp
      targetRole,
      ...paymentMetadata                // Spread payment details
    }

    // Update user document in the database with the new role and extended payment history
    await db().updateDoc('users', userId, {
      role: targetRole,
      paymentHistory: [...((user.paymentHistory as unknown[]) || []), paymentHistoryItem],
      updatedAt: new Date()
    })
    // TODO: Adopt Next.js 16 `revalidatePath` or `revalidateTag` to force freshness of user cache after mutation if user role is cached in server components.

    // Log: Upgrade success with both old and new role for traceability
    logger.info('Role upgrade: User role upgraded successfully', {
      userId,
      previousRole: user.role,
      newRole: targetRole,
      paymentReference: paymentMetadata.paymentReference
    })

    // Return result
    return {
      success: true,
      newRole: targetRole
    }

  } catch (error) {
    // Log: Error encountered during upgrade attempt
    logger.error('Role upgrade: Error upgrading user role', {
      userId,
      targetRole,
      error
    })

    // Return result with error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
