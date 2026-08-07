/**
 * Email CRM draft types — no runtime deps beyond type-only ToolUsageRecord.
 */

import type { ToolUsageRecord } from '@/features/email-crm/pipeline/ai/response-generator'

export type DraftStatus = 'pending' | 'approved' | 'edited' | 'sent' | 'rejected' | 'auto_sent'

export interface EmailDraft {
  id: string
  messageId: string
  threadId: string
  draftContent: string
  draftHtml: string | null
  confidenceScore: number
  modelUsed: string
  modelReasoning: string | null
  toolsUsed: ToolUsageRecord[]
  status: DraftStatus
  reviewedBy: string | null
  reviewedAt: Date | null
  editNotes: string | null
  sentAt: Date | null
  sentMessageId: string | null
  createdAt: Date
}

export interface DraftCreateInput {
  messageId: string
  threadId: string
  draftContent: string
  draftHtml?: string
  confidenceScore: number
  modelUsed: string
  modelReasoning?: string
  toolsUsed?: ToolUsageRecord[]
}

export interface DraftUpdateInput {
  draftContent?: string
  draftHtml?: string
  status?: DraftStatus
  editNotes?: string
}

export interface DraftApprovalResult {
  draft: EmailDraft
  shouldAutoSend: boolean
  requiresReview: boolean
  warnings: string[]
}

export interface AutoSendConfig {
  enabled: boolean
  minConfidence: number
  allowedIntents: string[]
  maxDailyAutoSends: number
  requireSecurityPass: boolean
  excludeNewContacts: boolean
  excludeHighPriority: boolean
}

export interface DraftRepository {
  findById(id: string): Promise<EmailDraft | null>
  findByMessageId(messageId: string): Promise<EmailDraft | null>
  findByThreadId(threadId: string): Promise<EmailDraft[]>
  findPending(limit?: number): Promise<EmailDraft[]>
  create(input: DraftCreateInput): Promise<EmailDraft>
  update(id: string, input: DraftUpdateInput): Promise<EmailDraft>
  markSent(id: string, sentMessageId: string): Promise<EmailDraft>
  countTodayAutoSends(): Promise<number>
}
