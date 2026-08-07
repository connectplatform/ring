import type { Conversation, ConversationParticipant } from '@/features/chat/types'

/** Resolve the avatar to show for a conversation in roster / header. */
export function getConversationAvatarUrl(
  conversation: Conversation,
  currentUserId: string,
): string | undefined {
  if (conversation.type === 'group') {
    // No group photo yet — roster falls back to initial / glyph
    return undefined
  }

  if (conversation.type === 'direct') {
    const other =
      conversation.participants.find((p) => p.userId === conversation.metadata.directUserId) ||
      conversation.participants.find((p) => p.userId !== currentUserId)
    return other?.avatarUrl
  }

  // Prefer any participant avatar (entity/product/opportunity)
  const withAvatar = conversation.participants.find(
    (p) => p.userId !== currentUserId && p.avatarUrl,
  )
  return withAvatar?.avatarUrl
}

export function getParticipantInitial(
  participant: ConversationParticipant | undefined,
  fallbackTitle: string,
): string {
  const name = participant?.displayName || fallbackTitle
  return (name.trim().charAt(0) || '?').toUpperCase()
}
