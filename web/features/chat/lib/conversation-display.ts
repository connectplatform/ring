import type { Conversation } from '@/features/chat/types'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'
import { interactivePreviewLabel } from '@/features/chat/lib/interactive-notify'
import { resolveInteractiveKind } from '@/features/chat/lib/interactive-kind'

/** next-intl `t` or any `{key, values}` lookup. Omitted on the server keeps English fallbacks. */
export type ChatLabeler = (
  key: string,
  values?: Record<string, string | number>,
) => string

function tr(
  t: ChatLabeler | undefined,
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
): string {
  return t ? t(key, values) : fallback
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  direct: 'typeDirect',
  group: 'typeGroup',
  product: 'typeProduct',
  entity: 'typeEntity',
  opportunity: 'typeOpportunity',
  order_lab: 'typeOrderLab',
  support: 'typeSupport',
}

export function getConversationTypeLabel(
  type: string,
  t?: ChatLabeler,
): string {
  const key = TYPE_LABEL_KEYS[type]
  return key ? tr(t, key, type) : tr(t, 'typeConversation', type)
}

/**
 * SSOT conversation label helpers for roster + header.
 * Product (DAGI agent) chats use metadata.productName / subject — same inbox as human DMs.
 */
export function getConversationTitle(
  conversation: Conversation,
  currentUserId: string,
  t?: ChatLabeler,
): string {
  if (conversation.type === 'entity' && conversation.metadata.entityName) {
    return conversation.metadata.entityName
  }

  if (conversation.type === 'opportunity' && conversation.metadata.opportunityName) {
    const entity = conversation.metadata.entityName
    return entity
      ? `${entity} - ${conversation.metadata.opportunityName}`
      : conversation.metadata.opportunityName
  }

  if (conversation.type === 'group') {
    return conversation.metadata.groupName?.trim() || tr(t, 'titleGroup', 'Group')
  }

  if (conversation.type === 'direct') {
    if (conversation.metadata.directUserName) {
      return conversation.metadata.directUserName
    }
    const other = conversation.participants.find((p) => p.userId !== currentUserId)
    if (other?.displayName) {
      return other.displayName
    }
    return other ? other.userId : tr(t, 'titleDirect', 'Direct')
  }

  if (conversation.type === 'product') {
    return (
      conversation.metadata.subject ||
      conversation.metadata.productName ||
      tr(t, 'titleProduct', 'Product chat')
    )
  }

  if (conversation.type === 'order_lab') {
    return conversation.metadata.subject || `Order Lab ${conversation.metadata.orderId || ''}`.trim()
  }

  if (conversation.type === 'support') {
    return conversation.metadata.subject || tr(t, 'titleSupport', 'Support')
  }

  return tr(t, 'titleConversation', 'Conversation')
}

export function getConversationSubtitle(
  conversation: Conversation,
  currentUserId: string,
  t?: ChatLabeler,
): string {
  if (conversation.type === 'product') {
    return conversation.metadata.productName
      ? tr(t, 'titleProductAgentNamed', `Product agent · ${conversation.metadata.productName}`, {
          name: conversation.metadata.productName,
        })
      : tr(t, 'titleProductAgent', 'Product agent')
  }

  if (conversation.type === 'direct') {
    const other = conversation.participants.find((p) => p.userId !== currentUserId)
    return other?.isOnline
      ? tr(t, 'statusOnline', 'Online')
      : tr(t, 'statusOffline', 'Offline')
  }

  const participantCount = conversation.participants.length
  const onlineCount = conversation.participants.filter((p) => p.isOnline).length
  return tr(
    t,
    'participantsLine',
    `${participantCount} participants · ${onlineCount} online`,
    { count: participantCount, online: onlineCount },
  )
}

export function getLastMessagePreview(
  conversation: Conversation,
  currentUserId: string,
  t?: ChatLabeler,
): string {
  if (!conversation.lastMessage) {
    return tr(t, 'previewEmpty', 'No messages yet')
  }

  const last = conversation.lastMessage
  const { content, type, senderId } = last
  const isOwn = senderId === currentUserId
  const prefix = isOwn ? tr(t, 'previewYou', 'You: ') : ''

  // Dual-gate: prefer interactive kind (type OR metadata.kind)
  const interactive = resolveInteractiveKind(last)
  if (interactive) {
    return `${prefix}${interactivePreviewLabel(last)}`
  }

  switch (type) {
    case 'image':
      return `${prefix}${tr(t, 'previewImage', 'Image')}`
    case 'file':
      return `${prefix}${tr(t, 'previewFile', 'File')}`
    case 'system':
      return content
    default:
      return `${prefix}${content}`
  }
}

export function getConversationSearchText(
  conversation: Conversation,
  currentUserId: string,
): string {
  const title = getConversationTitle(conversation, currentUserId)
  const last = conversation.lastMessage?.content || ''
  const meta = [
    conversation.metadata.directUserName,
    conversation.metadata.entityName,
    conversation.metadata.opportunityName,
    conversation.metadata.productName,
    conversation.metadata.subject,
    conversation.metadata.groupName,
    conversation.type,
  ]
    .filter(Boolean)
    .join(' ')

  return `${title} ${last} ${meta}`.toLowerCase()
}

export function formatConversationTime(timestamp: unknown): string {
  const date = new Date(getMessageTimeMs(timestamp as Parameters<typeof getMessageTimeMs>[0]))
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString()
}

export function getConversationTypeGlyph(type: Conversation['type']): string {
  switch (type) {
    case 'entity':
      return '🏢'
    case 'opportunity':
      return '💼'
    case 'product':
      return '✨'
    case 'group':
      return '👥'
    case 'order_lab':
      return '🧪'
    case 'support':
      return '🛟'
    case 'direct':
    default:
      return '👤'
  }
}
