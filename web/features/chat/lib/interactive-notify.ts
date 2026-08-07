/**
 * Interactive message notify helper — preview / title / actionUrl by kind.
 * MessageService uses this instead of nested ternaries.
 */

import type { Conversation, Message } from '@/features/chat/types'
import {
  isInteractiveKind,
  resolveInteractiveKind,
  type InteractiveMessageType,
} from '@/features/chat/lib/interactive-kind'
import { NotificationPriority, NotificationType } from '@/features/notifications/types'

export interface InteractiveNotifyPayload {
  notificationType: NotificationType
  priority: NotificationPriority
  title: string
  body: string
  actionText: string
  actionUrl: string
  data: Record<string, unknown>
}

function truncate(text: string, max = 140): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function defaultChatUrl(conversationId: string): string {
  return `/messages?c=${encodeURIComponent(conversationId)}`
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const v = meta?.[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function buildInteractiveNotifyPayload(params: {
  conversation: Conversation
  conversationId: string
  senderId: string
  message: Message
}): InteractiveNotifyPayload {
  const { conversation, conversationId, senderId, message } = params
  const kind = resolveInteractiveKind(message)
  const meta = message.metadata

  const baseData: Record<string, unknown> = {
    conversationId,
    messageId: message.id,
    senderId,
  }

  if (!kind) {
    return {
      notificationType: NotificationType.MESSAGE_RECEIVED,
      priority: NotificationPriority.NORMAL,
      title:
        conversation.type === 'group'
          ? conversation.metadata.groupName || 'Group chat'
          : message.senderName || 'New message',
      body:
        message.type === 'image'
          ? 'Sent an image'
          : message.type === 'file'
            ? 'Sent a file'
            : truncate(message.content),
      actionText: 'Open chat',
      actionUrl: defaultChatUrl(conversationId),
      data: baseData,
    }
  }

  switch (kind as InteractiveMessageType) {
    case 'payment_request':
      return {
        notificationType: NotificationType.PAYMENT_REQUEST,
        priority: NotificationPriority.NORMAL,
        title: 'Payment request',
        body: truncate(message.content),
        actionText: 'View request',
        actionUrl: defaultChatUrl(conversationId),
        data: { ...baseData, kind: 'payment_request', metadata: meta },
      }

    case 'env_request': {
      const orderId = metaString(meta, 'orderId')
      return {
        notificationType: NotificationType.ENV_REQUEST,
        priority: NotificationPriority.HIGH,
        title: 'Key update requested',
        body: truncate(message.content),
        actionText: 'Update keys',
        actionUrl: orderId
          ? `/my-orders/${encodeURIComponent(orderId)}#secrets`
          : defaultChatUrl(conversationId),
        data: {
          ...baseData,
          kind: 'env_request',
          metadata: meta,
          ...(orderId ? { orderId } : {}),
        },
      }
    }

    case 'task':
      return {
        notificationType: NotificationType.TASK_ASSIGNED,
        priority: NotificationPriority.NORMAL,
        title: 'New task',
        body: truncate(message.content),
        actionText: 'View task',
        actionUrl: defaultChatUrl(conversationId),
        data: { ...baseData, kind: 'task', metadata: meta },
      }

    case 'poll': {
      const question = metaString(meta, 'question') ?? truncate(message.content)
      return {
        notificationType: NotificationType.POLL_CREATED,
        priority: NotificationPriority.NORMAL,
        title: 'New poll',
        body: question,
        actionText: 'Vote',
        actionUrl: defaultChatUrl(conversationId),
        data: { ...baseData, kind: 'poll', metadata: meta },
      }
    }

    case 'rsvp': {
      const title = metaString(meta, 'title') ?? 'RSVP'
      const binding = meta?.binding as
        | { targetType?: string; targetId?: string }
        | undefined
      let actionUrl = defaultChatUrl(conversationId)
      if (binding?.targetType === 'meetup' && binding.targetId) {
        actionUrl = `/meetups/${encodeURIComponent(binding.targetId)}`
      } else if (binding?.targetType === 'entity' && binding.targetId) {
        actionUrl = `/entities/${encodeURIComponent(binding.targetId)}`
      }
      return {
        notificationType: NotificationType.RSVP_INVITE,
        priority: NotificationPriority.NORMAL,
        title: 'RSVP invite',
        body: title,
        actionText: 'Respond',
        actionUrl,
        data: { ...baseData, kind: 'rsvp', metadata: meta },
      }
    }

    case 'dao_jar': {
      const poolSlug = metaString(meta, 'poolSlug')
      const title = metaString(meta, 'title') ?? 'DAO jar'
      return {
        notificationType: NotificationType.DAO_JAR_UPDATE,
        priority: NotificationPriority.NORMAL,
        title: 'DAO funding jar',
        body: title,
        actionText: 'View jar',
        actionUrl: poolSlug
          ? `/dao/${encodeURIComponent(poolSlug)}`
          : defaultChatUrl(conversationId),
        data: { ...baseData, kind: 'dao_jar', metadata: meta },
      }
    }

    case 'share_card': {
      const title = metaString(meta, 'title') ?? 'Shared item'
      const url = metaString(meta, 'url') ?? defaultChatUrl(conversationId)
      return {
        notificationType: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.NORMAL,
        title: message.senderName || 'Shared with you',
        body: `Shared: ${title}`,
        actionText: 'Open',
        actionUrl: url,
        data: { ...baseData, kind: 'share_card', metadata: meta },
      }
    }

    case 'game_request': {
      const title = metaString(meta, 'title') ?? metaString(meta, 'slug') ?? 'Game'
      const sessionId = metaString(meta, 'sessionId')
      const slug = metaString(meta, 'slug')
      return {
        notificationType: NotificationType.GAME_REQUEST,
        priority: NotificationPriority.NORMAL,
        title: 'Game challenge',
        body: `${message.senderName || 'Someone'} invited you to ${title}`,
        actionText: 'View challenge',
        actionUrl:
          sessionId && slug
            ? `/games/${encodeURIComponent(slug)}?session=${encodeURIComponent(sessionId)}`
            : defaultChatUrl(conversationId),
        data: { ...baseData, kind: 'game_request', metadata: meta },
      }
    }

    case 'product_card': {
      const title = metaString(meta, 'title') ?? 'Product'
      const url = metaString(meta, 'url') ?? defaultChatUrl(conversationId)
      const price = metaString(meta, 'price')
      const currency = metaString(meta, 'currency')
      return {
        notificationType: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.NORMAL,
        title: message.senderName || 'Product shared',
        body: price ? `${title} — ${price} ${currency || ''}`.trim() : title,
        actionText: 'View product',
        actionUrl: url,
        data: { ...baseData, kind: 'product_card', metadata: meta },
      }
    }

    default:
      return {
        notificationType: NotificationType.MESSAGE_RECEIVED,
        priority: NotificationPriority.NORMAL,
        title: message.senderName || 'New message',
        body: truncate(message.content),
        actionText: 'Open chat',
        actionUrl: defaultChatUrl(conversationId),
        data: baseData,
      }
  }
}

/** Status-change notifies (vote close, RSVP update, jar contribute) — domain services call this shape. */
export function buildInteractiveStatusNotify(params: {
  kind: InteractiveMessageType
  userId: string
  conversationId: string
  messageId: string
  title: string
  body: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}): {
  userId: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  body: string
  actionText: string
  actionUrl: string
  data: Record<string, unknown>
} {
  const { kind, userId, conversationId, messageId, title, body, metadata } = params
  let type = NotificationType.MESSAGE_RECEIVED
  let actionText = 'Open chat'
  let actionUrl = params.actionUrl ?? defaultChatUrl(conversationId)

  if (kind === 'poll') {
    type = NotificationType.POLL_CLOSED
    actionText = 'View results'
  } else if (kind === 'rsvp') {
    type = NotificationType.RSVP_UPDATED
    actionText = 'View RSVP'
  } else if (kind === 'dao_jar') {
    type = NotificationType.DAO_JAR_UPDATE
    actionText = 'View jar'
    const slug =
      typeof metadata?.poolSlug === 'string' ? metadata.poolSlug : null
    if (slug) actionUrl = `/dao/${encodeURIComponent(slug)}`
  } else if (kind === 'game_request') {
    type = NotificationType.GAME_UPDATED
    actionText = 'Open game'
    const slug = typeof metadata?.slug === 'string' ? metadata.slug : null
    const sessionId =
      typeof metadata?.sessionId === 'string' ? metadata.sessionId : null
    if (slug && sessionId) {
      actionUrl = `/games/${encodeURIComponent(slug)}?session=${encodeURIComponent(sessionId)}`
    }
  }

  return {
    userId,
    type,
    priority: NotificationPriority.NORMAL,
    title,
    body,
    actionText,
    actionUrl,
    data: {
      conversationId,
      messageId,
      kind,
      ...(metadata ? { metadata } : {}),
    },
  }
}

export function interactivePreviewLabel(message: Message): string {
  if (isInteractiveKind(message, 'payment_request')) return 'Payment request'
  if (isInteractiveKind(message, 'env_request')) return 'Key update requested'
  if (isInteractiveKind(message, 'task')) return 'Task'
  if (isInteractiveKind(message, 'poll')) return 'Poll'
  if (isInteractiveKind(message, 'rsvp')) return 'RSVP'
  if (isInteractiveKind(message, 'dao_jar')) return 'DAO jar'
  if (isInteractiveKind(message, 'share_card')) {
    const title =
      typeof message.metadata?.title === 'string' ? message.metadata.title : 'Shared item'
    return `Shared: ${title}`
  }
  if (isInteractiveKind(message, 'game_request')) {
    const title =
      typeof message.metadata?.title === 'string'
        ? message.metadata.title
        : typeof message.metadata?.slug === 'string'
          ? message.metadata.slug
          : 'Game'
    return `Game: ${title}`
  }
  return message.content
}
