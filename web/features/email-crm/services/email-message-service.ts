import 'server-only'

import type { ParsedEmail } from '@/features/email-crm/pipeline/parser/email-parser'
import type { IntentClassification } from '@/features/email-crm/pipeline/ai/intent-classifier'
import type { SentimentAnalysis } from '@/features/email-crm/pipeline/ai/sentiment-analyzer'
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
  /** crm-ops router outcome (OSINT queue / lead). */
  routeFlag?: string | null
  unsubscribeUrl?: string | null
  unsubscribeOneClick?: boolean
  /** Human channel label for multi-mailbox CRM. */
  sourceChannel?: string
  channelId?: string
  channelName?: string
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
    sentiment?: SentimentAnalysis,
    channel?: { channelId?: string; channelName?: string; sourceChannel?: string },
    crmOps?: {
      routeFlag?: string | null
      unsubscribeUrl?: string | null
      unsubscribeOneClick?: boolean
    }
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
        sourceChannel: channel?.sourceChannel || channel?.channelName,
        channelId: channel?.channelId,
        channelName: channel?.channelName,
        routeFlag: crmOps?.routeFlag ?? null,
        unsubscribeUrl: crmOps?.unsubscribeUrl ?? null,
        unsubscribeOneClick: Boolean(crmOps?.unsubscribeOneClick),
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

  /** Contact-form inquiry row (inbound from lead/customer into CRM). */
  async upsertContactFormInquiry(params: {
    messageId: string
    threadId: string
    fromEmail: string
    fromName: string | null
    subject: string
    bodyText: string
  }): Promise<{ id: string }> {
    const now = new Date().toISOString()
    return upsertDoc<EmailMessageRecord>(COLLECTION, params.messageId, {
      threadId: params.threadId,
      messageId: params.messageId,
      inReplyTo: null,
      fromEmail: params.fromEmail,
      fromName: params.fromName,
      subject: params.subject,
      bodyText: params.bodyText,
      bodyTextClean: params.bodyText,
      intent: 'contact_form',
      isInbound: true,
      date: now,
      processedAt: now,
      sourceChannel: 'contact-form',
    })
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
