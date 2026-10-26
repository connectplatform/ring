import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationTrigger,
  NotificationType,
  type Notification,
} from '@/features/notifications/types'

export type ListTypeFilter = 'all' | 'unread' | NotificationType

/**
 * Apply one inbox tunnel payload to the rows already on screen.
 * The payload is the row. Callers must not refetch the list for this event.
 */
export function applyInboxToFeed(
  items: Notification[],
  payload: Record<string, unknown>,
  typeFilter: ListTypeFilter,
): Notification[] {
  const action = String(payload.action ?? payload.type ?? 'notification')

  if (action === 'read' && payload.notificationId) {
    const id = String(payload.notificationId)
    if (typeFilter === 'unread') return items.filter((item) => item.id !== id)
    return items.map((item) =>
      item.id === id
        ? { ...item, status: NotificationStatus.READ, readAt: item.readAt ?? new Date() }
        : item,
    )
  }

  if (action === 'read_all') {
    if (typeFilter === 'unread') return []
    const readAt = new Date()
    return items.map((item) => ({
      ...item,
      status: NotificationStatus.READ,
      readAt: item.readAt ?? readAt,
    }))
  }

  if (action === 'delete' && payload.notificationId) {
    const id = String(payload.notificationId)
    return items.filter((item) => item.id !== id)
  }

  if (action !== 'notification') return items

  const incoming = payload.notification as
    | (Partial<Notification> & { id?: string; title?: string })
    | undefined
  if (!incoming?.id || !incoming.title) return items

  const incomingType = (incoming.type as NotificationType) ?? NotificationType.SYSTEM_UPDATE
  if (typeFilter !== 'all' && typeFilter !== 'unread' && incomingType !== typeFilter) {
    return items
  }

  const mapped: Notification = {
    id: incoming.id,
    userId: incoming.userId ?? '',
    title: incoming.title,
    body: incoming.body ?? '',
    type: incomingType,
    priority: (incoming.priority as NotificationPriority) ?? NotificationPriority.NORMAL,
    status: (incoming.status as NotificationStatus) ?? NotificationStatus.SENT,
    trigger: (incoming.trigger as NotificationTrigger) ?? NotificationTrigger.SYSTEM_EVENT,
    channels: (incoming.channels as NotificationChannel[]) ?? [NotificationChannel.IN_APP],
    deliveries: incoming.deliveries ?? [],
    data: incoming.data ?? {},
    createdAt: incoming.createdAt ? new Date(incoming.createdAt) : new Date(),
    readAt: incoming.readAt ? new Date(incoming.readAt) : undefined,
    actionText: incoming.actionText,
    actionUrl: incoming.actionUrl,
  }

  return [mapped, ...items.filter((item) => item.id !== mapped.id)]
}
