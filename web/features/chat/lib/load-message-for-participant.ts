import 'server-only'

import { ConversationService } from '@/features/chat/services/conversation-service'
import { MessageService } from '@/features/chat/services/message-service'
import type { Message } from '@/features/chat/types'

/**
 * Load a message and prove the actor is a conversation participant.
 * Mirrors TaskService.loadTask access pattern (getConversationById returns null if denied).
 */
export async function loadMessageForParticipant(
  messageId: string,
  userId: string,
): Promise<{ message: Message; conversationId: string } | { error: string }> {
  const messages = new MessageService()
  const message = await messages.getMessage(messageId)
  if (!message) return { error: 'Message not found' }

  const conversations = new ConversationService()
  const conversation = await conversations.getConversationById(
    message.conversationId,
    userId,
  )
  if (!conversation) return { error: 'Access denied' }

  return { message, conversationId: message.conversationId }
}
