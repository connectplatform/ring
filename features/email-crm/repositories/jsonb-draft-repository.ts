import 'server-only'

import { randomUUID } from 'crypto'
import {
  DraftRepository,
  DraftCreateInput,
  DraftUpdateInput,
  EmailDraft,
} from '@/services/email/drafts/draft-service'
import type { ToolUsageRecord } from '@/services/email/ai/response-generator'
import { parseIsoDate, queryDocs, readDoc, upsertDoc } from '@/features/email-crm/lib/jsonb-collection'

const COLLECTION = 'email_drafts'

function hydrateDraft(id: string, raw: Record<string, unknown>): EmailDraft {
  return {
    id,
    messageId: String(raw.messageId ?? ''),
    threadId: String(raw.threadId ?? ''),
    draftContent: String(raw.draftContent ?? ''),
    draftHtml: raw.draftHtml != null ? String(raw.draftHtml) : null,
    confidenceScore: Number(raw.confidenceScore ?? 0),
    modelUsed: String(raw.modelUsed ?? ''),
    modelReasoning: raw.modelReasoning != null ? String(raw.modelReasoning) : null,
    toolsUsed: (Array.isArray(raw.toolsUsed) ? raw.toolsUsed : []) as ToolUsageRecord[],
    status: (raw.status as EmailDraft['status']) ?? 'pending',
    reviewedBy: raw.reviewedBy != null ? String(raw.reviewedBy) : null,
    reviewedAt: parseIsoDate(raw.reviewedAt),
    editNotes: raw.editNotes != null ? String(raw.editNotes) : null,
    sentAt: parseIsoDate(raw.sentAt),
    sentMessageId: raw.sentMessageId != null ? String(raw.sentMessageId) : null,
    createdAt: parseIsoDate(raw.createdAt) ?? new Date(),
  }
}

function toStored(draft: Partial<EmailDraft>): Record<string, unknown> {
  return {
    messageId: draft.messageId,
    threadId: draft.threadId,
    draftContent: draft.draftContent,
    draftHtml: draft.draftHtml,
    confidenceScore: draft.confidenceScore,
    modelUsed: draft.modelUsed,
    modelReasoning: draft.modelReasoning,
    toolsUsed: draft.toolsUsed,
    status: draft.status,
    reviewedBy: draft.reviewedBy,
    reviewedAt: draft.reviewedAt?.toISOString() ?? null,
    editNotes: draft.editNotes,
    sentAt: draft.sentAt?.toISOString() ?? null,
    sentMessageId: draft.sentMessageId,
    createdAt: draft.createdAt?.toISOString(),
  }
}

export class JsonbDraftRepository implements DraftRepository {
  async findById(id: string): Promise<EmailDraft | null> {
    const doc = await readDoc<Record<string, unknown>>(COLLECTION, id)
    return doc ? hydrateDraft(doc.id, doc) : null
  }

  async findByMessageId(messageId: string): Promise<EmailDraft | null> {
    const rows = await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [{ field: 'messageId', operator: '=', value: messageId }],
      limit: 1,
    })
    return rows[0] ? hydrateDraft(rows[0].id, rows[0]) : null
  }

  async findByThreadId(threadId: string): Promise<EmailDraft[]> {
    const rows = await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [{ field: 'threadId', operator: '=', value: threadId }],
      limit: 50,
    })
    return rows.map((row) => hydrateDraft(row.id, row))
  }

  async findPending(limit = 50): Promise<EmailDraft[]> {
    const rows = await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [{ field: 'status', operator: '=', value: 'pending' }],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit,
    })
    return rows.map((row) => hydrateDraft(row.id, row))
  }

  async create(input: DraftCreateInput): Promise<EmailDraft> {
    const id = `draft_${randomUUID()}`
    const draft: EmailDraft = {
      id,
      messageId: input.messageId,
      threadId: input.threadId,
      draftContent: input.draftContent,
      draftHtml: input.draftHtml ?? null,
      confidenceScore: input.confidenceScore,
      modelUsed: input.modelUsed,
      modelReasoning: input.modelReasoning ?? null,
      toolsUsed: input.toolsUsed ?? [],
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      editNotes: null,
      sentAt: null,
      sentMessageId: null,
      createdAt: new Date(),
    }
    await upsertDoc(COLLECTION, id, toStored(draft))
    return draft
  }

  async update(id: string, input: DraftUpdateInput): Promise<EmailDraft> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Draft not found')
    const updated: EmailDraft = { ...existing, ...input }
    await upsertDoc(COLLECTION, id, toStored(updated))
    return updated
  }

  async markSent(id: string, sentMessageId: string): Promise<EmailDraft> {
    const existing = await this.findById(id)
    if (!existing) throw new Error('Draft not found')
    const updated: EmailDraft = {
      ...existing,
      sentAt: new Date(),
      sentMessageId,
    }
    await upsertDoc(COLLECTION, id, toStored(updated))
    return updated
  }

  async countTodayAutoSends(): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await queryDocs<Record<string, unknown>>({
      collection: COLLECTION,
      filters: [{ field: 'status', operator: '=', value: 'auto_sent' }],
      limit: 500,
    })
    return rows.filter((row) => {
      const sentAt = parseIsoDate(row.sentAt)
      return sentAt && sentAt >= today
    }).length
  }
}
