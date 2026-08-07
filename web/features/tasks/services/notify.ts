import 'server-only'

import { getTranslations } from 'next-intl/server'
import { createNotification } from '@/features/notifications/services/notification-service'
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@/features/notifications/types'
import type { TaskMetadata, TaskStatus } from '@/features/chat/types'
import { taskStatusLabel } from '@/features/tasks/types'
import { logger } from '@/lib/logger'

async function safeNotify(
  label: string,
  request: Parameters<typeof createNotification>[0],
): Promise<void> {
  try {
    await createNotification(request)
  } catch (error) {
    logger.warn(`Task notify failed: ${label}`, { error })
  }
}

function actionUrl(conversationId: string): string {
  return `/messages?c=${conversationId}`
}

function otherPartyUserId(meta: TaskMetadata, actorUserId: string): string | null {
  if (meta.reporterUserId === actorUserId) {
    return meta.assigneeUserId ?? meta.requestedByUserId ?? null
  }
  return meta.reporterUserId
}

type TaskNotifyTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string

async function loadTaskNotifyTranslations(): Promise<TaskNotifyTranslator | null> {
  try {
    const t = await getTranslations('modules.tasks')
    return (key, values) => t(key as Parameters<typeof t>[0], values as Parameters<typeof t>[1])
  } catch {
    return null
  }
}

function localizedStatus(
  t: TaskNotifyTranslator | null,
  status: TaskStatus,
): string {
  if (t) {
    try {
      return t(`status.${status}`)
    } catch {
      // fall through
    }
  }
  return taskStatusLabel(status)
}

function titleForAction(action: string, t: TaskNotifyTranslator | null): string {
  if (t) {
    switch (action) {
      case 'escrow_held':
        return t('notifications.escrowHeldTitle')
      case 'assigned':
        return t('notifications.assignedTitle')
      default:
        return t('notifications.updatedTitle')
    }
  }

  switch (action) {
    case 'start':
      return 'Task started'
    case 'request':
      return 'Task request submitted'
    case 'approve_request':
      return 'Task request approved'
    case 'reject_request':
      return 'Task request rejected'
    case 'complete':
      return 'Task marked complete'
    case 'accept':
      return 'Task accepted'
    case 'dispute':
      return 'Task disputed'
    case 'cancel':
      return 'Task canceled'
    case 'escrow_held':
      return 'Task escrow funded'
    default:
      return 'Task updated'
  }
}

export async function notifyTaskUpdated(input: {
  meta: TaskMetadata
  messageId: string
  conversationId: string
  actorUserId: string
  action: string
}): Promise<void> {
  const recipientId = otherPartyUserId(input.meta, input.actorUserId)
  if (!recipientId) return

  const t = await loadTaskNotifyTranslations()
  const statusLabel = localizedStatus(t, input.meta.status)
  const url = actionUrl(input.conversationId)
  const isHigh =
    input.action === 'dispute' ||
    input.action === 'accept' ||
    input.action === 'escrow_held' ||
    input.meta.status === 'disputed'

  await safeNotify(input.action, {
    userId: recipientId,
    type: NotificationType.TASK_UPDATED,
    priority: isHigh ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    title: titleForAction(input.action, t),
    body: t
      ? t('notifications.updatedBody', { status: statusLabel })
      : `Task status: ${statusLabel}`,
    data: {
      actionUrl: url,
      metadata: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        taskStatus: input.meta.status,
        action: input.action,
      },
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    actionText: t ? t('notifications.viewTask') : 'Open chat',
    actionUrl: url,
  })
}

export async function notifyTaskEscrowHeld(input: {
  reporterUserId: string
  conversationId: string
  messageId: string
  escrowId: string
}): Promise<void> {
  const t = await loadTaskNotifyTranslations()
  const url = actionUrl(input.conversationId)
  await safeNotify('escrow_held', {
    userId: input.reporterUserId,
    type: NotificationType.TASK_UPDATED,
    priority: NotificationPriority.HIGH,
    title: t ? t('notifications.escrowHeldTitle') : 'Task escrow funded',
    body: t
      ? t('notifications.escrowHeldBody')
      : 'Your task escrow payment was received and funds are held.',
    data: {
      actionUrl: url,
      metadata: {
        messageId: input.messageId,
        conversationId: input.conversationId,
        escrowId: input.escrowId,
      },
    },
    channels: [NotificationChannel.IN_APP],
    actionText: t ? t('notifications.viewTask') : 'Open chat',
    actionUrl: url,
  })
}

export async function notifyTaskAssigned(input: {
  assigneeUserId: string
  conversationId: string
  messageId: string
}): Promise<void> {
  const t = await loadTaskNotifyTranslations()
  const url = actionUrl(input.conversationId)
  await safeNotify('assigned', {
    userId: input.assigneeUserId,
    type: NotificationType.TASK_ASSIGNED,
    priority: NotificationPriority.HIGH,
    title: t ? t('notifications.assignedTitle') : 'Task assigned to you',
    body: t ? t('notifications.assignedBody') : 'A task was assigned to you in chat.',
    data: {
      actionUrl: url,
      metadata: {
        messageId: input.messageId,
        conversationId: input.conversationId,
      },
    },
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    actionText: t ? t('notifications.viewTask') : 'Open chat',
    actionUrl: url,
  })
}
