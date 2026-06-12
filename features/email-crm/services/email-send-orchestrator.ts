import 'server-only'

import { getEmailSender } from '@/services/email/smtp'
import { getEmailDraftService } from '@/services/email/drafts/draft-service'
import { EmailMessageService } from './email-message-service'
import { EmailThreadService } from './email-thread-service'

export async function sendDraftReply(params: {
  draftId: string
  toEmail: string
  subject: string
  threadId: string
  inReplyTo?: string | null
  references?: string[]
  wasAutoSent?: boolean
}): Promise<{ messageId: string }> {
  const draftService = getEmailDraftService()
  const draft = await draftService.getDraft(params.draftId)
  if (!draft) throw new Error('Draft not found')

  const { messageId } = await getEmailSender().sendReply({
    to: params.toEmail,
    subject: params.subject,
    text: draft.draftContent,
    html: draft.draftHtml ?? undefined,
    inReplyTo: params.inReplyTo,
    references: params.references,
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
