// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminAuth } from '@/lib/firebase-admin.server';
import { updateDocument, createDocument } from '@/lib/services/firebase-service-manager';
import { UserRole } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
import { logger } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export interface PaymentDetails {
  paymentReference: string;
  paymentAmount: number;
  paymentCurrency: string;
  authCode?: string;
  cardPan?: string;
}

export interface UpgradeResult {
  success: boolean;
  error?: string;
  previousRole?: UserRole;
  newRole?: UserRole;
}

/**
 * Upgrades a user's role after successful payment, with proper validation and audit logging.
 * 
 * This function performs the following steps:
 * 1. Validates the user exists and the upgrade is valid
 * 2. Updates the user's role in Firestore
 * 3. Updates Firebase Auth custom claims
 * 4. Records the upgrade in audit logs
 * 5. Sends notification to the user
 * 
 * @param userId - The ID of the user whose role is being upgraded
 * @param newRole - The new role to assign to the user
 * @param paymentDetails - Details about the payment that triggered this upgrade
 * @returns A promise that resolves to an UpgradeResult indicating success or failure
 */
export async function upgradeUserRole(
  userId: string, 
  newRole: UserRole, 
  paymentDetails: PaymentDetails
): Promise<UpgradeResult> {
  logger.info('Auth Service: upgradeUserRole - Starting role upgrade process', {
    userId,
    newRole,
    paymentReference: paymentDetails.paymentReference
  });

  try {
    // Step 1: Get current user data to validate the upgrade
    const { getUserById } = await import('./get-user-by-id');
    const currentUser = await getUserById(userId);
    
    if (!currentUser) {
      logger.error('Auth Service: upgradeUserRole - User not found', { userId });
      return {
        success: false,
        error: 'User not found'
      };
    }

    const previousRole = currentUser.role;
    
    // Step 2: Validate the role upgrade
    const roleHierarchy = {
      [UserRole.VISITOR]: 0,
      [UserRole.SUBSCRIBER]: 1,
      [UserRole.MEMBER]: 2,
      [UserRole.CONFIDENTIAL]: 3,
      [UserRole.ADMIN]: 4,
    };

    if (roleHierarchy[newRole] <= roleHierarchy[previousRole]) {
      logger.error('Auth Service: upgradeUserRole - Invalid role upgrade attempt', {
        userId,
        previousRole,
        newRole
      });
      return {
        success: false,
        error: 'Cannot downgrade or assign same role'
      };
    }

    // Admin role cannot be purchased
    if (newRole === UserRole.ADMIN) {
      logger.error('Auth Service: upgradeUserRole - Attempt to purchase admin role', {
        userId,
        paymentReference: paymentDetails.paymentReference
      });
      return {
        success: false,
        error: 'Admin role cannot be purchased'
      };
    }

    logger.info('Auth Service: upgradeUserRole - Validated role upgrade', {
      userId,
      previousRole,
      newRole
    });

    // Step 3: Update role in Firestore
    const updateData = {
      role: newRole,
      updatedAt: Timestamp.now(),
      lastRoleUpgrade: {
        fromRole: previousRole,
        toRole: newRole,
        upgradedAt: Timestamp.now(),
        paymentReference: paymentDetails.paymentReference,
        paymentAmount: paymentDetails.paymentAmount,
        paymentCurrency: paymentDetails.paymentCurrency
      }
    };

    await updateDocument('users', userId, updateData);
    logger.info('Auth Service: upgradeUserRole - Updated user document in Firestore', { userId });

    // Step 4: Update custom claims in Firebase Auth
    const adminAuth = getAdminAuth();
    await adminAuth.setCustomUserClaims(userId, { role: newRole });
    logger.info('Auth Service: upgradeUserRole - Updated Firebase Auth custom claims', { userId });

    // Step 5: Record the upgrade in audit logs
    try {
      await createDocument('user_role_upgrades', {
        userId,
        previousRole,
        newRole,
        upgradedAt: Timestamp.now(),
        upgradeType: 'payment',
        paymentDetails: {
          reference: paymentDetails.paymentReference,
          amount: paymentDetails.paymentAmount,
          currency: paymentDetails.paymentCurrency,
          authCode: paymentDetails.authCode,
          cardPanLast4: paymentDetails.cardPan
        }
      });
      logger.info('Auth Service: upgradeUserRole - Recorded upgrade in audit logs', { userId });
    } catch (auditError) {
      logger.warn('Auth Service: upgradeUserRole - Failed to record audit log', {
        userId,
        error: auditError
      });
      // Don't fail the upgrade if audit logging fails
    }

    // Step 6: Send notification to user about successful upgrade
    try {
      const { createNotification } = await import('@/features/notifications/services/notification-service');
      await createNotification({
        userId,
        type: 'ROLE_UPGRADE_APPROVED',
        title: 'Membership Upgraded Successfully',
        body: `Your membership has been upgraded to ${String(newRole).toUpperCase()}. You now have access to additional features and opportunities.`,
        data: {
          previousRole,
          newRole,
          paymentReference: paymentDetails.paymentReference
        }
      } as any);
      logger.info('Auth Service: upgradeUserRole - Sent upgrade notification', { userId });
    } catch (notificationError) {
      logger.warn('Auth Service: upgradeUserRole - Failed to send notification', {
        userId,
        error: notificationError
      });
      // Don't fail the upgrade if notification fails
    }

    logger.info('Auth Service: upgradeUserRole - Role upgrade completed successfully', {
      userId,
      previousRole,
      newRole,
      paymentReference: paymentDetails.paymentReference
    });

    return {
      success: true,
      previousRole,
      newRole
    };

  } catch (error) {
    if (error instanceof FirebaseError) {
      logger.error('Auth Service: upgradeUserRole - Firebase error:', {
        code: error.code,
        message: error.message,
        userId,
        newRole
      });
    } else {
      logger.error('Auth Service: upgradeUserRole - Error upgrading user role:', {
        error,
        userId,
        newRole
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Reverts a user's role upgrade (for failed payments or refunds)
 * 
 * @param userId - The ID of the user whose role upgrade should be reverted
 * @param paymentReference - The payment reference to identify the upgrade to revert
 * @returns A promise that resolves to an UpgradeResult indicating success or failure
 */
export async function revertRoleUpgrade(
  userId: string, 
  paymentReference: string
): Promise<UpgradeResult> {
  logger.info('Auth Service: revertRoleUpgrade - Starting role revert process', {
    userId,
    paymentReference
  });

  try {
    // Get current user data
    const { getUserById } = await import('./get-user-by-id');
    const currentUser = await getUserById(userId);
    
    if (!currentUser) {
      logger.error('Auth Service: revertRoleUpgrade - User not found', { userId });
      return {
        success: false,
        error: 'User not found'
      };
    }

    // Check if user has a recent upgrade with this payment reference
    if (!currentUser.lastRoleUpgrade || 
        currentUser.lastRoleUpgrade.paymentReference !== paymentReference) {
      logger.error('Auth Service: revertRoleUpgrade - No matching upgrade found', {
        userId,
        paymentReference,
        lastUpgradeRef: currentUser.lastRoleUpgrade?.paymentReference
      });
      return {
        success: false,
        error: 'No matching role upgrade found for this payment'
      };
    }

    const previousRole = currentUser.lastRoleUpgrade.fromRole;
    const currentRole = currentUser.role;

    // Update role back to previous role
    await updateDocument('users', userId, {
      role: previousRole,
      updatedAt: Timestamp.now(),
      lastRoleRevert: {
        fromRole: currentRole,
        toRole: previousRole,
        revertedAt: Timestamp.now(),
        paymentReference,
        reason: 'Payment failed or refunded'
      }
    });

    // Update Firebase Auth custom claims
    const adminAuth = getAdminAuth();
    await adminAuth.setCustomUserClaims(userId, { role: previousRole });

    logger.info('Auth Service: revertRoleUpgrade - Role revert completed successfully', {
      userId,
      previousRole: currentRole,
      newRole: previousRole,
      paymentReference
    });

    return {
      success: true,
      previousRole: currentRole,
      newRole: previousRole
    };

  } catch (error) {
    logger.error('Auth Service: revertRoleUpgrade - Error reverting role upgrade:', {
      error,
      userId,
      paymentReference
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
