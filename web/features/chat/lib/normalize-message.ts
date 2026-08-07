import type { Message } from '@/features/chat/types'

/**
 * Coerce API / tunnel payload into a Message the UI can render.
 */
export function normalizeMessagePayload(raw: unknown, conversationId: string): Message | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Partial<Message> & { id?: string; conversationId?: string }
  if (!m.id || !m.senderId) return null
  return {
    ...m,
    id: m.id,
    conversationId: m.conversationId || conversationId,
    senderId: m.senderId,
    senderName: m.senderName || 'User',
    content: m.content ?? '',
    type: m.type || 'text',
    status: m.status || 'sent',
    timestamp: m.timestamp as Message['timestamp'],
  } as Message
}
