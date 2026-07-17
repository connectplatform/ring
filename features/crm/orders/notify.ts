import 'server-only'

import { createNotification } from '@/features/notifications/services/notification-service'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/features/notifications/types'
import { logger } from '@/lib/logger'

async function safeNotify(
  label: string,
  request: Parameters<typeof createNotification>[0],
): Promise<void> {
  try {
    await createNotification(request)
  } catch (error) {
    logger.warn(`CRM notify failed: ${label}`, { error })
  }
}

export async function notifyProjectOrderPaid(input: {
  orderId: string
  buyerUserId: string
}): Promise<void> {
  await safeNotify('paid', {
    userId: input.buyerUserId,
    type: NotificationType.PAYMENT_REQUEST,
    priority: NotificationPriority.NORMAL,
    title: 'Project order paid',
    body: `Your ringization deposit for ${input.orderId} was received.`,
    data: {
      actionUrl: `/calculator/success?orderId=${input.orderId}`,
      metadata: { orderId: input.orderId },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'View order',
    actionUrl: `/calculator/success?orderId=${input.orderId}`,
  })
}

export async function notifyProjectOrderAvailable(input: {
  orderId: string
  buyerUserId: string
  opportunityId: string
}): Promise<void> {
  await safeNotify('available', {
    userId: input.buyerUserId,
    type: NotificationType.OPPORTUNITY_CREATED,
    priority: NotificationPriority.NORMAL,
    title: 'Project order listed',
    body: `Your order ${input.orderId} is now available for integrator requests.`,
    data: {
      opportunityId: input.opportunityId,
      actionUrl: `/opportunities/${input.opportunityId}`,
      metadata: { orderId: input.orderId },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'View opportunity',
    actionUrl: `/opportunities/${input.opportunityId}`,
  })
}

export async function notifyProjectOrderRequested(input: {
  orderId: string
  buyerUserId: string
  requestorUserId: string
  opportunityId: string
}): Promise<void> {
  await safeNotify('requested', {
    userId: input.buyerUserId,
    type: NotificationType.OPPORTUNITY_APPLIED,
    priority: NotificationPriority.NORMAL,
    title: 'New integrator request',
    body: `Someone requested your project order ${input.orderId}.`,
    data: {
      opportunityId: input.opportunityId,
      userId: input.requestorUserId,
      actionUrl: `/admin/crm/orders/${input.orderId}`,
      metadata: { orderId: input.orderId, requestorUserId: input.requestorUserId },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'Open CRM order',
    actionUrl: `/admin/crm/orders/${input.orderId}`,
  })
}

export async function notifyProjectOrderAssigned(input: {
  orderId: string
  integratorUserId: string
  buyerUserId: string
}): Promise<void> {
  await safeNotify('assigned-integrator', {
    userId: input.integratorUserId,
    type: NotificationType.OPPORTUNITY_MATCHED_AI,
    priority: NotificationPriority.HIGH,
    title: 'You were assigned a project job',
    body: `Order ${input.orderId} is now on your My Jobs list.`,
    data: {
      actionUrl: '/my-jobs',
      metadata: { orderId: input.orderId },
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    actionText: 'Open My Jobs',
    actionUrl: '/my-jobs',
  })
  await safeNotify('assigned-buyer', {
    userId: input.buyerUserId,
    type: NotificationType.OPPORTUNITY_UPDATED,
    priority: NotificationPriority.NORMAL,
    title: 'Integrator assigned',
    body: `An integrator was assigned to order ${input.orderId}.`,
    data: {
      userId: input.integratorUserId,
      actionUrl: `/calculator/success?orderId=${input.orderId}`,
      metadata: { orderId: input.orderId, integratorUserId: input.integratorUserId },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'View status',
    actionUrl: `/calculator/success?orderId=${input.orderId}`,
  })
}

export async function notifyProjectOrderRefunded(input: {
  orderId: string
  buyerUserId: string
}): Promise<void> {
  await safeNotify('refunded', {
    userId: input.buyerUserId,
    type: NotificationType.WALLET_TRANSACTION,
    priority: NotificationPriority.HIGH,
    title: 'Project order canceled & refunded',
    body: `Order ${input.orderId} was canceled. Refund processing started.`,
    data: {
      actionUrl: '/wallet',
      metadata: { orderId: input.orderId },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'View wallet',
    actionUrl: '/wallet',
  })
}

export async function notifyProjectOrderProgress(input: {
  orderId: string
  buyerUserId: string
  progress: number
  workStatus: string
}): Promise<void> {
  const completed = input.workStatus === 'completed'
  const disputed = input.workStatus === 'disputed'
  await safeNotify('progress', {
    userId: input.buyerUserId,
    type: NotificationType.OPPORTUNITY_UPDATED,
    priority: completed || disputed ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    title: completed
      ? 'Project job completed'
      : disputed
        ? 'Project job disputed'
        : 'Project job progress update',
    body: completed
      ? `Your order ${input.orderId} was marked completed by the integrator.`
      : disputed
        ? `Your order ${input.orderId} was flagged as disputed.`
        : `Order ${input.orderId} is now ${input.progress}% (${input.workStatus}).`,
    data: {
      actionUrl: `/calculator/success?orderId=${input.orderId}`,
      metadata: {
        orderId: input.orderId,
        progress: input.progress,
        workStatus: input.workStatus,
      },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: 'View status',
    actionUrl: `/calculator/success?orderId=${input.orderId}`,
  })
}
