import 'server-only'

import { getEmailSender } from '@/features/email-crm/pipeline/smtp'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'
import { EmailMessageService } from './email-message-service'
import { EmailThreadService } from './email-thread-service'
import { logger } from '@/lib/logger'

export type SendDraftReplyResult =
  | { messageId: string; skipped?: false }
  | {
      skipped: true
      reason: 'prefer_chat'
      notice: string
      messageId?: undefined
    }

export async function sendDraftReply(params: {
  draftId: string
  toEmail: string
  subject: string
  threadId: string
  inReplyTo?: string | null
  references?: string[]
  wasAutoSent?: boolean
  /** CRM channel id — selects per-channel SMTP (not AUTH SMTP_*). */
  channelId?: string
}): Promise<SendDraftReplyResult> {
  const draftService = getEmailDraftService()
  const draft = await draftService.getDraft(params.draftId)
  if (!draft) throw new Error('Draft not found')

  // Client opted into in-app chat — soft-skip email (notice, not hard error)
  const thread = await EmailThreadService.getThread(params.threadId)
  if (thread?.preferChat) {
    const notice =
      'Client is using in-app support chat for this request; email reply was not sent.'
    logger.info('[EmailSendOrchestrator] Draft send skipped — preferChat', {
      draftId: params.draftId,
      threadId: params.threadId,
    })
    return { skipped: true, reason: 'prefer_chat', notice }
  }

  const { getChannelById, getPrimaryEmailConfig } = await import(
    '@/features/email-crm/pipeline/imap/config'
  )
  const channel = getChannelById(params.channelId)
  const smtpConfig = channel?.config.smtp || getPrimaryEmailConfig().smtp

  const { messageId } = await getEmailSender().sendReply({
    to: params.toEmail,
    subject: params.subject,
    text: draft.draftContent,
    html: draft.draftHtml ?? undefined,
    inReplyTo: params.inReplyTo,
    references: params.references,
    threadId: params.threadId,
    smtpConfig,
  })

  await draftService.markSent(params.draftId, messageId, params.wasAutoSent ?? false)

  await EmailMessageService.upsertOutboundMessage({
    messageId,
    threadId: params.threadId,
    toEmail: params.toEmail,
    subject: params.subject,
    bodyText: draft.draftContent,
    inReplyTo: params.inReplyTo,
  })

  await EmailThreadService.upsertThread(params.threadId, {
    subject: params.subject,
    fromEmail: params.toEmail,
    status: 'waiting',
    messageCount: 1,
    lastMessageAt: new Date().toISOString(),
  })

  return { messageId }
}
