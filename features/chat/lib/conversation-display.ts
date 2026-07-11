import type { Conversation } from '@/features/chat/types'
import { getMessageTimeMs } from '@/features/chat/lib/message-time'

/**
 * SSOT conversation label helpers for roster + header.
 * Product (DAGI agent) chats use metadata.productName / subject — same inbox as human DMs.
 */
export function getConversationTitle(
  conversation: Conversation,
  currentUserId: string,
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
    return conversation.metadata.groupName?.trim() || 'Group'
  }

  if (conversation.type === 'direct') {
    if (conversation.metadata.directUserName) {
      return conversation.metadata.directUserName
    }
    const other = conversation.participants.find((p) => p.userId !== currentUserId)
    if (other?.displayName) {
      return other.displayName
    }
    return other ? other.userId : 'Direct'
  }

  if (conversation.type === 'product') {
    return (
      conversation.metadata.subject ||
      conversation.metadata.productName ||
      'Product chat'
    )
  }

  return 'Conversation'
}

export function getConversationSubtitle(
  conversation: Conversation,
  currentUserId: string,
): string {
  if (conversation.type === 'product') {
    return conversation.metadata.productName
      ? `Product agent · ${conversation.metadata.productName}`
      : 'Product agent'
  }

  if (conversation.type === 'direct') {
    const other = conversation.participants.find((p) => p.userId !== currentUserId)
    return other?.isOnline ? 'Online' : 'Offline'
  }

  const participantCount = conversation.participants.length
  const onlineCount = conversation.participants.filter((p) => p.isOnline).length
  return `${participantCount} participant${participantCount !== 1 ? 's' : ''} · ${onlineCount} online`
}

export function getLastMessagePreview(
  conversation: Conversation,
  currentUserId: string,
): string {
  if (!conversation.lastMessage) {
    return 'No messages yet'
  }

  const { content, type, senderId } = conversation.lastMessage
  const isOwn = senderId === currentUserId
  const prefix = isOwn ? 'You: ' : ''

  switch (type) {
    case 'image':
      return `${prefix}Image`
    case 'file':
      return `${prefix}File`
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
    case 'direct':
    default:
      return '👤'
  }
}
