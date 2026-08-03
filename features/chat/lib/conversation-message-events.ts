/**
 * Client-side bridge for system / call lifecycle messages that are persisted via
 * HTTP (call-invite / call-event) but must appear in the open thread immediately.
 * Mirrors the entity-update CustomEvent pattern used by discovery hooks.
 */

import type { Message } from '@/features/chat/types'

export const CONVERSATION_MESSAGE_EVENT = 'conversation-message'

export type ConversationMessageDetail = {
  conversationId: string
  message: Message
}

export function emitConversationMessage(conversationId: string, message: Message): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ConversationMessageDetail>(CONVERSATION_MESSAGE_EVENT, {
      detail: { conversationId, message },
    }),
  )
}

export function isConversationMessageEvent(
  event: Event,
): event is CustomEvent<ConversationMessageDetail> {
  return event instanceof CustomEvent && event.type === CONVERSATION_MESSAGE_EVENT
}
