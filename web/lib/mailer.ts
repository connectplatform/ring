/**
 * Ring Mailer — SSOT Nodemailer transport for auth + CRM outbound.
 * server-only: never import from Client Components.
 */
import 'server-only'

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { logger } from '@/lib/logger'

export type SendMailParams = {
  to: string
  subject: string
  text: string
  html?: string
  from?: string
  headers?: Record<string, string>
  replyTo?: string
}

function smtpPassword(): string {
  return process.env.SMTP_PASSWORD || process.env.SMTP_PASS || ''
}

function smtpFrom(): string {
  return (
    process.env.SMTP_FROM ||
    process.env.AUTH_EMAIL_FROM ||
    process.env.SMTP_USER ||
    'Ring Platform <noreply@ring-platform.org>'
  )
}

/** True when Ethereal or real SMTP credentials are present. */
export function isRingMailerConfigured(): boolean {
  if (process.env.EMAIL_MODE === 'ethereal') return true
  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) return true
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = smtpPassword()
  return Boolean(host && user && pass)
}

let transporterPromise: Promise<Transporter> | null = null

async function createTransporter(): Promise<Transporter> {
  const mode = process.env.EMAIL_MODE || 'smtp'

  if (mode === 'ethereal' || (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production')) {
    const user = process.env.ETHEREAL_USER
    const pass = process.env.ETHEREAL_PASS
    if (user && pass) {
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user, pass },
      })
    }
    const testAccount = await nodemailer.createTestAccount()
    logger.info('[RingMailer] Ethereal test account created', { user: testAccount.user })
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    })
  }

  const host = process.env.SMTP_HOST || 'mail.ringdom.org'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const secure =
    process.env.SMTP_SECURE === 'true' || port === 465
  const user = process.env.SMTP_USER || ''
  const pass = smtpPassword()

  if (!user || !pass) {
    throw new Error('Ring Mailer: SMTP_USER and SMTP_PASSWORD (or SMTP_PASS) are required')
  }

  return nodemailer.createTransport({
    pool: true,
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

export async function getMailTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = createTransporter()
  }
  return transporterPromise
}

export async function sendMail(params: SendMailParams): Promise<{ messageId: string }> {
  const transport = await getMailTransporter()
  const result = await transport.sendMail({
    from: params.from || smtpFrom(),
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: params.headers,
    replyTo: params.replyTo,
  })

  const messageId = result.messageId || `mail_${Date.now()}`
  const preview = nodemailer.getTestMessageUrl(result)
  if (preview) {
    logger.info('[RingMailer] Ethereal preview', { to: params.to, preview })
  } else {
    logger.info('[RingMailer] Sent', { to: params.to, messageId, subject: params.subject })
  }
  return { messageId }
}

export function getSmtpFromAddress(): string {
  return smtpFrom()
}
