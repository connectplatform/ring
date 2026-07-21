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
  /** Channel SMTP from loadCrmChannels(); falls back to primary CRM channel. */
  smtpConfig?: EmailConfig['smtp']
}

export class EmailSenderService {
  async sendReply(params: SendReplyParams): Promise<{ messageId: string }> {
    const refs = params.references?.filter(Boolean) ?? []
    const headers: Record<string, string> = {}
    if (params.inReplyTo) {
      headers['In-Reply-To'] = params.inReplyTo
      headers.References = refs.length > 0 ? refs.join(' ') : params.inReplyTo
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
    const result = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject.startsWith('Re:') ? params.subject : `Re: ${params.subject}`,
      text: params.text,
      html: params.html,
      headers,
    })

    const messageId = result.messageId || `crm_${Date.now()}`
    logger.info('[EmailSender] Reply sent via CRM channel SMTP', {
      to: params.to,
      messageId,
      smtpHost: smtp.host,
      from,
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
