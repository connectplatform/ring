/**
 * TD-UX-03 — Close poll messages whose metadata.closeAt is in the past.
 */
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { Message, PollMetadata } from '@/features/chat/types'

const MAX_OPEN_POLLS_SCAN = 200

export async function closeExpiredPolls(): Promise<{
  success: boolean
  scanned: number
  closed: number
  duration: number
}> {
  const started = Date.now()
  try {
    const result = await db().queryDocs<Message>({
      collection: 'messages',
      filters: [
        { field: 'type', operator: '==', value: 'poll' },
        {
          field: 'metadata',
          operator: 'jsonb-contains',
          value: { kind: 'poll', status: 'open' },
        },
      ],
      pagination: { limit: MAX_OPEN_POLLS_SCAN },
    })

    const rows = result.success && result.data ? result.data : []
    const now = Date.now()
    const expired = rows.filter((msg) => {
      const meta = msg.metadata as unknown as PollMetadata | undefined
      if (!meta || meta.kind !== 'poll' || meta.status !== 'open') return false
      if (!meta.closeAt) return false
      const closeMs = new Date(meta.closeAt).getTime()
      return Number.isFinite(closeMs) && closeMs < now
    })

    if (expired.length === 0) {
      return {
        success: true,
        scanned: rows.length,
        closed: 0,
        duration: Date.now() - started,
      }
    }

    const { MessageService } = await import('@/features/chat/services/message-service')
    const messages = new MessageService()
    let closed = 0

    for (const msg of expired) {
      const meta = msg.metadata as unknown as PollMetadata
      const nextMeta: PollMetadata = { ...meta, status: 'closed' }
      await messages.updateMessage(msg.id, {
        metadata: nextMeta as unknown as Record<string, unknown>,
      })
      closed += 1
    }

    return {
      success: true,
      scanned: rows.length,
      closed,
      duration: Date.now() - started,
    }
  } catch (error) {
    logger.error('closeExpiredPolls failed', { error })
    return {
      success: false,
      scanned: 0,
      closed: 0,
      duration: Date.now() - started,
    }
  }
}
