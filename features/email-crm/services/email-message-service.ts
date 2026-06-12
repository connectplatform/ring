import 'server-only'

import type { ParsedEmail } from '@/services/email/parser/email-parser'
import type { IntentClassification } from '@/services/email/ai/intent-classifier'
import type { SentimentAnalysis } from '@/services/email/ai/sentiment-analyzer'
import { readDoc, upsertDoc, queryDocs } from '@/features/email-crm/lib/jsonb-collection'

const COLLECTION = 'email_messages'

export interface EmailMessageRecord extends Record<string, unknown> {
  threadId: string
  messageId: string
  inReplyTo: string | null
  fromEmail: string
  fromName: string | null
  subject: string
  bodyText: string | null
  bodyTextClean: string
  intent?: string
  sentiment?: string
  isInbound: boolean
  date: string
  processedAt: string
  contentHash?: string
}

export const EmailMessageService = {
  async exists(messageId: string): Promise<boolean> {
    const doc = await readDoc<EmailMessageRecord>(COLLECTION, messageId)
    return doc !== null
  },

  async upsertInboundMessage(
    parsed: ParsedEmail,
    threadId: string,
    intent?: IntentClassification,
    sentiment?: SentimentAnalysis
  ): Promise<{ id: string }> {
    return upsertDoc<EmailMessageRecord>(
      COLLECTION,
      parsed.messageId,
      {
        threadId,
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        fromEmail: parsed.from.email,
        fromName: parsed.from.name,
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyTextClean: parsed.bodyTextClean,
        intent: intent?.intent,
        sentiment: sentiment?.sentiment,
        isInbound: true,
        date: parsed.date.toISOString(),
        processedAt: new Date().toISOString(),
        contentHash: parsed.contentHash,
      },
      {
        threadId,
        messageId: parsed.messageId,
        isInbound: true,
        date: parsed.date.toISOString(),
        processedAt: new Date().toISOString(),
      }
    )
  },

  async upsertOutboundMessage(params: {
    messageId: string
    threadId: string
    toEmail: string
    subject: string
    bodyText: string
    inReplyTo?: string | null
  }): Promise<{ id: string }> {
    const now = new Date().toISOString()
    return upsertDoc<EmailMessageRecord>(
      COLLECTION,
      params.messageId,
      {
        threadId: params.threadId,
        messageId: params.messageId,
        inReplyTo: params.inReplyTo ?? null,
        fromEmail: params.toEmail,
        fromName: null,
        subject: params.subject,
        bodyText: params.bodyText,
        bodyTextClean: params.bodyText,
        isInbound: false,
        date: now,
        processedAt: now,
      }
    )
  },

  async listByThread(threadId: string): Promise<Array<EmailMessageRecord & { id: string }>> {
    const rows = await queryDocs<EmailMessageRecord>({
      collection: COLLECTION,
      filters: [{ field: 'threadId', operator: '=', value: threadId }],
      orderBy: [{ field: 'date', direction: 'asc' }],
      limit: 100,
    })
    return rows
  },
}
