import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export type EmailThreadStatus = 'new' | 'ongoing' | 'waiting' | 'resolved'

export interface EmailThreadRecord {
  subject: string
  fromEmail: string
  fromName?: string | null
  status: EmailThreadStatus
  priority: 'low' | 'normal' | 'high' | 'urgent'
  intent?: string
  sentiment?: string
  messageCount: number
  hasDraft: boolean
  lastMessageAt: string
  createdAt: string
  contact?: { type?: string; company?: string | null; interactions?: number }
}

const COLLECTION = 'email_threads'

export const EmailThreadService = {
  async listThreads(options: { status?: EmailThreadStatus; limit?: number } = {}): Promise<
    Array<EmailThreadRecord & { id: string }>
  > {
    const filters = options.status
      ? [{ field: 'status', operator: '=' as const, value: options.status }]
      : []

    const result = await db().queryDocs<EmailThreadRecord>({
      collection: COLLECTION,
      filters,
      orderBy: [{ field: 'lastMessageAt', direction: 'desc' }],
      pagination: { limit: options.limit ?? 100 },
    })

    if (!result.success || !result.data) return []
    return result.data
  },

  async upsertThread(
    id: string,
    record: Partial<EmailThreadRecord> & Pick<EmailThreadRecord, 'subject' | 'fromEmail'>
  ): Promise<{ id: string }> {
    const now = new Date().toISOString()

    const existing = await db().readDoc<EmailThreadRecord>(COLLECTION, id)
    if (existing.success && existing.data) {
      const current = existing.data
      await db().updateDoc(COLLECTION, id, {
        ...current,
        ...record,
        messageCount: (current.messageCount || 0) + (record.messageCount ?? 0),
        lastMessageAt: record.lastMessageAt || now,
      })
      return { id }
    }

    const created = await db().createDoc(
      COLLECTION,
      {
        status: 'new',
        priority: 'normal',
        messageCount: 1,
        hasDraft: false,
        createdAt: now,
        lastMessageAt: now,
        ...record,
      },
      { id }
    )
    if (!created.success) {
      logger.error('EmailThreadService: create failed', { id, error: created.error })
      throw created.error || new Error('Failed to create email thread')
    }
    return { id }
  },

  async getThread(id: string): Promise<(EmailThreadRecord & { id: string }) | null> {
    const existing = await db().readDoc<EmailThreadRecord>(COLLECTION, id)
    if (!existing.success || !existing.data) return null
    return existing.data
  },

  async updateStatus(id: string, status: EmailThreadStatus): Promise<boolean> {
    const existing = await db().readDoc<EmailThreadRecord>(COLLECTION, id)
    if (!existing.success || !existing.data) return false

    const result = await db().updateDoc(COLLECTION, id, { ...existing.data, status })
    return result.success
  },
}
