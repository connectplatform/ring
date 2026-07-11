import type { Conversation, CreateConversationRequest } from '@/features/chat/types'

export type CreateConversationFn = (
  data: CreateConversationRequest,
) => Promise<Conversation | null>

/**
 * Resolve an existing direct conversation from the inbox, or create one.
 * Server create also dedupes via findDirectConversation when both participant ids are present.
 */
export async function openOrCreateDirectConversation(params: {
  currentUserId: string
  targetUserId: string
  displayName?: string
  conversations: Conversation[]
  createConversation: CreateConversationFn
}): Promise<Conversation | null> {
  const { currentUserId, targetUserId, displayName, conversations, createConversation } = params

  if (!currentUserId || !targetUserId || targetUserId === currentUserId) {
    return null
  }

  const existing = conversations.find(
    (conv) =>
      conv.type === 'direct' &&
      conv.participants.some((p) => p.userId === targetUserId),
  )

  if (existing) {
    return existing
  }

  return createConversation({
    type: 'direct',
    participantIds: [currentUserId, targetUserId],
    metadata: {
      directUserId: targetUserId,
      ...(displayName ? { directUserName: displayName } : {}),
    },
  })
}
