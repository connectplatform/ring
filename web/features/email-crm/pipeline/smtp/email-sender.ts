/**
 * SMTP outbound — CRM replies via per-channel transport (not AUTH SMTP_*).
 */

import nodemailer from 'nodemailer'
import type { EmailConfig } from '../imap/config'
import { getPrimaryEmailConfig } from '../imap/config'
import { logger } from '@/lib/logger'

export interface SendReplyParams {
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string | null
  references?: string[]
  /** CRM thread id — stamped into body + X-Ring-Support-Thread header */
  threadId?: string
  /** Channel SMTP from loadCrmChannels(); falls back to primary CRM channel. */
  smtpConfig?: EmailConfig['smtp']
}

export class EmailSenderService {
  async sendReply(params: SendReplyParams): Promise<{ messageId: string }> {
    const { appendThreadMarker, formatThreadMarker, RING_THREAD_HEADER } = await import(
      '@/features/email-crm/lib/thread-marker'
    )
    const refs = params.references?.filter(Boolean) ?? []
    const headers: Record<string, string> = {}
    if (params.inReplyTo) {
      headers['In-Reply-To'] = params.inReplyTo
      headers.References = refs.length > 0 ? refs.join(' ') : params.inReplyTo
    }
    if (params.threadId) {
      headers[RING_THREAD_HEADER] = params.threadId
    }

    const smtp = params.smtpConfig || getPrimaryEmailConfig().smtp
    if (!smtp?.auth?.user || !smtp?.auth?.pass) {
      throw new Error('CRM SMTP credentials missing for reply (CRM_CHANNEL_*_PASSWORD)')
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.auth.user, pass: smtp.auth.pass },
    })

    const from = smtp.from || smtp.auth.user
    const text = params.threadId
      ? appendThreadMarker(params.text, params.threadId)
      : params.text
    const html = params.html
      ? params.threadId
        ? `${params.html}<pre style="font-size:11px;color:#888">${formatThreadMarker(params.threadId).trim()}</pre>`
        : params.html
      : undefined

    const result = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
      text,
      html,
      headers,
    })

    const messageId = result.messageId || `crm_${Date.now()}`
    logger.info('[EmailSender] Reply sent via CRM channel SMTP', {
      to: params.to,
      messageId,
      smtpHost: smtp.host,
      from,
      threadId: params.threadId,
    })
    return { messageId }
  }
}

let senderInstance: EmailSenderService | null = null

export function getEmailSender(): EmailSenderService {
  if (!senderInstance) {
    senderInstance = new EmailSenderService()
  }
  return senderInstance
}
