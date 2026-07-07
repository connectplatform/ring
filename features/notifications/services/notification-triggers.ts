/**
 * Notification Triggers
 * Helper functions to trigger notifications for specific events in Ring platform
 * These functions can be called from other services when events occur
 */

import { createNotification } from './notification-service';
import { 
  NotificationType, 
  NotificationPriority, 
  NotificationChannel,
  CreateNotificationRequest 
} from '@/features/notifications/types';
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role';

// ------------------------------------------------------------------------------
// Opportunity-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Triggers a notification when a new opportunity is created.
 * @param opportunityId - The ID of the created opportunity.
 * @param opportunityTitle - The title of the created opportunity.
 * @param createdBy - The userId of the creator.
 * @param isConfidential - Whether the opportunity is confidential.
 */
export async function notifyOpportunityCreated(
  opportunityId: string,
  opportunityTitle: string,
  createdBy: string,
  isConfidential: boolean = false
): Promise<void> {
  console.log('NotificationTriggers: Opportunity created', { opportunityId, opportunityTitle });
  try {
    // STUB: Get users who should be notified (e.g. subscribers, followers, team members)
    // TODO: Implement logic to fetch subscribers/followers of the opportunity for notification

    // For now, only notify the creator
    const notificationRequest: CreateNotificationRequest = {
      userId: createdBy,
      type: NotificationType.OPPORTUNITY_CREATED,
      priority: NotificationPriority.NORMAL,
      title: 'Opportunity Created Successfully',
      body: `Your opportunity "${opportunityTitle}" has been created and is now live.`,
      data: {
        opportunityId,
        opportunityTitle,
        actionUrl: `/opportunities/${opportunityId}`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Opportunity',
      actionUrl: `/opportunities/${opportunityId}`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    // Error handling: logs error if notification could not be created
    console.error('NotificationTriggers: Error notifying opportunity created:', error);
  }
}

/**
 * Triggers a notification when an opportunity is updated.
 * @param opportunityId - The ID of the updated opportunity.
 * @param opportunityTitle - The title of the updated opportunity.
 * @param updatedBy - The userId who performed the update.
 */
export async function notifyOpportunityUpdated(
  opportunityId: string,
  opportunityTitle: string,
  updatedBy: string
): Promise<void> {
  console.log('NotificationTriggers: Opportunity updated', { opportunityId, opportunityTitle });
  try {
    // STUB: Notify interested users (saved by, applied to, etc.)
    // TODO: Implement logic to get interested users who interacted with the opportunity

    // Notifying the user who performed the update (placeholder)
    const notificationRequest: CreateNotificationRequest = {
      userId: updatedBy,
      type: NotificationType.OPPORTUNITY_UPDATED,
      priority: NotificationPriority.LOW,
      title: 'Opportunity Updated',
      body: `The opportunity "${opportunityTitle}" has been updated.`,
      data: {
        opportunityId,
        opportunityTitle,
        actionUrl: `/opportunities/${opportunityId}`
      },
      channels: [NotificationChannel.IN_APP],
      actionText: 'View Changes',
      actionUrl: `/opportunities/${opportunityId}`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying opportunity updated:', error);
  }
}

/**
 * Triggers a notification when an opportunity expires for the creator.
 * @param opportunityId - The expired opportunity's ID.
 * @param opportunityTitle - The opportunity title.
 * @param createdBy - The creator's user ID.
 */
export async function notifyOpportunityExpired(
  opportunityId: string,
  opportunityTitle: string,
  createdBy: string
): Promise<void> {
  console.log('NotificationTriggers: Opportunity expired', { opportunityId, opportunityTitle });
  try {
    const notificationRequest: CreateNotificationRequest = {
      userId: createdBy,
      type: NotificationType.OPPORTUNITY_EXPIRED,
      priority: NotificationPriority.HIGH,
      title: 'Opportunity Expired',
      body: `Your opportunity "${opportunityTitle}" has expired and is no longer active.`,
      data: {
        opportunityId,
        opportunityTitle,
        actionUrl: `/opportunities/${opportunityId}`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'Renew Opportunity',
      actionUrl: `/opportunities/${opportunityId}/edit`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying opportunity expired:', error);
  }
}

// ------------------------------------------------------------------------------
// Entity-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Triggers a notification when a new entity is created by a user.
 * @param entityId - The created entity's ID.
 * @param entityName - The created entity's name.
 * @param createdBy - The creator's user ID.
 */
export async function notifyEntityCreated(
  entityId: string,
  entityName: string,
  createdBy: string
): Promise<void> {
  console.log('NotificationTriggers: Entity created', { entityId, entityName });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId: createdBy,
      type: NotificationType.ENTITY_CREATED,
      priority: NotificationPriority.NORMAL,
      title: 'Entity Created Successfully',
      body: `Your entity "${entityName}" has been created and is now available.`,
      data: {
        entityId,
        entityName,
        actionUrl: `/entities/${entityId}`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Entity',
      actionUrl: `/entities/${entityId}`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying entity created:', error);
  }
}

/**
 * Triggers a notification when an entity is verified.
 * @param entityId - Verified entity's ID.
 * @param entityName - Verified entity's name.
 * @param ownerId - Owner's user ID.
 */
export async function notifyEntityVerified(
  entityId: string,
  entityName: string,
  ownerId: string
): Promise<void> {
  console.log('NotificationTriggers: Entity verified', { entityId, entityName });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId: ownerId,
      type: NotificationType.ENTITY_VERIFIED,
      priority: NotificationPriority.HIGH,
      title: 'Entity Verified! 🎉',
      body: `Congratulations! Your entity "${entityName}" has been verified and now has enhanced credibility.`,
      data: {
        entityId,
        entityName,
        actionUrl: `/entities/${entityId}`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Verified Entity',
      actionUrl: `/entities/${entityId}`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying entity verified:', error);
  }
}

// ------------------------------------------------------------------------------
// User account-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Notifies a user of their submission for a role upgrade request.
 * @param userId - The user submitting the request.
 * @param fromRole - The current role.
 * @param toRole - The requested role.
 * @param requestId - The upgrade request ID.
 */
export async function notifyRoleUpgradeRequest(
  userId: string,
  fromRole: UserRolesArray,
  toRole: UserRolesArray,
  requestId: string
): Promise<void> {
  console.log('NotificationTriggers: Role upgrade request', { userId, fromRole, toRole });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.ROLE_UPGRADE_REQUEST,
      priority: NotificationPriority.NORMAL,
      title: 'Role Upgrade Request Submitted',
      body: `Your request to upgrade from ${fromRole} to ${toRole} has been submitted and is under review.`,
      data: {
        userId,
        userRole: fromRole,
        metadata: { requestId, fromRole, toRole }
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Request Status',
      actionUrl: `/profile/role-upgrade`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying role upgrade request:', error);
  }
}

/**
 * Notifies a user when their role upgrade is approved.
 * @param userId - The user who is upgraded.
 * @param newRole - The new user role after upgrade.
 * @param approvedBy - The admin/approver's user ID.
 */
export async function notifyRoleUpgradeApproved(
  userId: string,
  newRole: UserRolesArray,
  approvedBy: string
): Promise<void> {
  console.log('NotificationTriggers: Role upgrade approved', { userId, newRole });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.ROLE_UPGRADE_APPROVED,
      priority: NotificationPriority.HIGH,
      title: 'Role Upgrade Approved! 🎉',
      body: `Congratulations! Your role has been upgraded to ${newRole}. You now have access to additional features.`,
      data: {
        userId,
        userRole: newRole,
        metadata: { approvedBy }
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'Explore New Features',
      actionUrl: `/profile`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying role upgrade approved:', error);
  }
}

/**
 * Notifies a user if their role upgrade is rejected, with reason.
 * @param userId - The user who requested the upgrade.
 * @param requestedRole - The requested role.
 * @param rejectionReason - Reason for rejection.
 */
export async function notifyRoleUpgradeRejected(
  userId: string,
  requestedRole: UserRolesArray,
  rejectionReason: string
): Promise<void> {
  console.log('NotificationTriggers: Role upgrade rejected', { userId, requestedRole });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.ROLE_UPGRADE_REJECTED,
      priority: NotificationPriority.NORMAL,
      title: 'Role Upgrade Request Update',
      body: `Your request to upgrade to ${requestedRole} was not approved. Reason: ${rejectionReason}`,
      data: {
        userId,
        userRole: requestedRole,
        metadata: { rejectionReason }
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'Submit New Request',
      actionUrl: `/profile/role-upgrade`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying role upgrade rejected:', error);
  }
}

// ------------------------------------------------------------------------------
// Wallet-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Notifies a user when a new wallet is created for them.
 * @param userId - The user to notify.
 * @param walletAddress - The wallet address created.
 */
export async function notifyWalletCreated(
  userId: string,
  walletAddress: string
): Promise<void> {
  console.log('NotificationTriggers: Wallet created', { userId, walletAddress });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.WALLET_CREATED,
      priority: NotificationPriority.NORMAL,
      title: 'Crypto Wallet Created Successfully',
      body: `Your new crypto wallet has been created and is ready to use.`,
      data: {
        walletAddress,
        actionUrl: `/wallet`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Wallet',
      actionUrl: `/wallet`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying wallet created:', error);
  }
}

/**
 * Notifies a user of a wallet transaction.
 * @param userId - The wallet owner.
 * @param walletAddress - Their wallet address.
 * @param transactionHash - Transaction hash.
 * @param amount - Amount transacted.
 * @param currency - Currency symbol.
 * @param type - 'sent' or 'received'.
 */
export async function notifyWalletTransaction(
  userId: string,
  walletAddress: string,
  transactionHash: string,
  amount: string,
  currency: string,
  type: 'sent' | 'received'
): Promise<void> {
  console.log('NotificationTriggers: Wallet transaction', { userId, transactionHash, type });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.WALLET_TRANSACTION,
      priority: NotificationPriority.HIGH,
      title: `Transaction ${type === 'sent' ? 'Sent' : 'Received'}`,
      body: `You have ${type} ${amount} ${currency}. Transaction confirmed.`,
      data: {
        walletAddress,
        transactionHash,
        amount,
        currency,
        metadata: { type },
        actionUrl: `/wallet/transactions/${transactionHash}`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Transaction',
      actionUrl: `/wallet/transactions/${transactionHash}`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying wallet transaction:', error);
  }
}

// ------------------------------------------------------------------------------
// System-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Broadcast a system maintenance notice to a group of users.
 * @param userIds - Array of user IDs to notify.
 * @param maintenanceWindow - Scheduled time for maintenance.
 * @param description - Additional maintenance information.
 */
export async function notifySystemMaintenance(
  userIds: string[],
  maintenanceWindow: string,
  description: string
): Promise<void> {
  console.log('NotificationTriggers: System maintenance', { userCount: userIds.length });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userIds, // Field supports bulk notification for multiple users
      type: NotificationType.SYSTEM_MAINTENANCE,
      priority: NotificationPriority.HIGH,
      title: 'Scheduled Maintenance Notice',
      body: `Ring will undergo maintenance ${maintenanceWindow}. ${description}`,
      data: {
        maintenanceWindow,
        metadata: { description }
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'Learn More',
      actionUrl: `/system/maintenance`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying system maintenance:', error);
  }
}

/**
 * Notifies a user of a security alert event.
 * @param userId - User to notify.
 * @param alertType - Type of alert (e.g. "login_attempt", "password_change", etc)
 * @param description - Additional message/description.
 */
export async function notifySecurityAlert(
  userId: string,
  alertType: string,
  description: string
): Promise<void> {
  console.log('NotificationTriggers: Security alert', { userId, alertType });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.SECURITY_ALERT,
      priority: NotificationPriority.URGENT,
      title: 'Security Alert',
      body: `Security alert: ${description}. Please review your account immediately.`,
      data: {
        securityReason: alertType,
        metadata: { description },
        actionUrl: `/security/alerts`
      },
      channels: [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS // TODO: In future, integrate more finely controlled preferences for SMS
      ],
      actionText: 'Review Security',
      actionUrl: `/security/alerts`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying security alert:', error);
  }
}

// ------------------------------------------------------------------------------
// KYC-related notification triggers
// ------------------------------------------------------------------------------

/**
 * Notifies a user that KYC (identity verification) is required, with the reason as context.
 * @param userId - The user ID needing KYC.
 * @param reason - Why KYC is required.
 */
export async function notifyKYCRequired(
  userId: string,
  reason: string
): Promise<void> {
  console.log('NotificationTriggers: KYC required', { userId, reason });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.KYC_REQUIRED,
      priority: NotificationPriority.HIGH,
      title: 'Identity Verification Required',
      body: `Please complete your identity verification to continue using Ring. ${reason}`,
      data: {
        metadata: { reason },
        actionUrl: `/kyc/verify`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'Start Verification',
      actionUrl: `/kyc/verify`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying KYC required:', error);
  }
}

/**
 * Notifies a user that their KYC (identity verification) has been approved.
 * @param userId - The user ID who completed KYC.
 * @param verificationLevel - Level of verification approved.
 */
export async function notifyKYCApproved(
  userId: string,
  verificationLevel: string
): Promise<void> {
  console.log('NotificationTriggers: KYC approved', { userId, verificationLevel });

  try {
    const notificationRequest: CreateNotificationRequest = {
      userId,
      type: NotificationType.KYC_APPROVED,
      priority: NotificationPriority.HIGH,
      title: 'Identity Verification Approved! 🎉',
      body: `Your identity verification (${verificationLevel}) has been approved. You now have full access to Ring.`,
      data: {
        metadata: { verificationLevel },
        actionUrl: `/profile`
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      actionText: 'View Profile',
      actionUrl: `/profile`
    };

    await createNotification(notificationRequest);
  } catch (error) {
    console.error('NotificationTriggers: Error notifying KYC approved:', error);
  }
}

/**
 * CODEMOD SUGGESTIONS FOR React 19 / Next 16 (not immediately applicable):
 * // TODO: If converting to React Server Components & Next.js 16 App router, 
 * - Consider moving notification triggers to server actions or API routes for secure and stateless processing
 * - Migrate repeated notificationRequest logic to a utility/builder function to apply DRY principle
 * - Use TypeScript type inference improvements for stricter notification type safety
 * - Use parallel Promise APIs for bulk notifications (see notifySystemMaintenance)
 * Note: This file is backend logic, so direct `use` of React/Next features likely happens at callsite not in this module.
 */