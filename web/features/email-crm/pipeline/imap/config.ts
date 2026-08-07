/**
 * Email CRM IMAP/SMTP configuration
 * =================================
 * Multi-channel SSOT: ring-config.emailCrm.channels[]
 * Secrets: CRM_CHANNEL_<ID>_PASSWORD (+ optional _SMTP_PASSWORD)
 * Legacy fallback: IMAP_* / SMTP_* env (synthetic "primary" channel)
 *
 * AUTH outbound (magic/OTP) uses lib/mailer.ts + SMTP_* — not this module.
 */

import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type {
  EmailCrmChannelConfig,
  EmailCrmChannelFlow,
} from '@/lib/ring-config-types'

export type ChannelFlow = EmailCrmChannelFlow

export interface EmailConfig {
  host: string
  port: number
  tls: boolean
  tlsRejectUnauthorized: boolean
  user: string
  password: string
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
    from?: string
  }
  polling: {
    interval: number
    batchSize: number
  }
  mailbox: string
  processedFolder: string
  spamFolder: string
}

export interface ResolvedCrmChannel {
  id: string
  name: string
  flow: ChannelFlow
  config: EmailConfig
}

function secretPrefix(channel: Pick<EmailCrmChannelConfig, 'id' | 'secretEnvPrefix'>): string {
  if (channel.secretEnvPrefix?.trim()) return channel.secretEnvPrefix.trim()
  return `CRM_CHANNEL_${channel.id.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`
}

function envPassword(prefix: string, ...suffixes: string[]): string {
  for (const suffix of suffixes) {
    const v = process.env[`${prefix}_${suffix}`]
    if (v) return v
  }
  return ''
}

function channelToEmailConfig(channel: EmailCrmChannelConfig): EmailConfig {
  const prefix = secretPrefix(channel)
  const imapPassword =
    envPassword(prefix, 'PASSWORD', 'IMAP_PASSWORD') ||
    process.env.IMAP_PASSWORD ||
    ''
  const smtpPassword =
    envPassword(prefix, 'SMTP_PASSWORD', 'PASSWORD') ||
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    imapPassword

  const smtpHost = channel.smtp?.host || channel.imap.host
  const smtpPort = channel.smtp?.port ?? 587
  const smtpUser = channel.smtp?.user || channel.imap.user

  return {
    host: channel.imap.host,
    port: channel.imap.port || 993,
    tls: channel.imap.tls !== false,
    tlsRejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    user: channel.imap.user,
    password: imapPassword,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      from: channel.smtp?.from,
    },
    polling: {
      interval: parseInt(process.env.EMAIL_POLLING_INTERVAL || '30000', 10),
      batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10),
    },
    mailbox: channel.imap.mailbox || process.env.EMAIL_MAILBOX || 'INBOX',
    processedFolder: process.env.EMAIL_PROCESSED_FOLDER || 'Processed',
    spamFolder: process.env.EMAIL_SPAM_FOLDER || 'Spam',
  }
}

function legacyPrimaryChannel(): ResolvedCrmChannel {
  const config: EmailConfig = {
    host: process.env.IMAP_HOST || 'mail.ringdom.org',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: process.env.IMAP_TLS !== 'false',
    tlsRejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    user: process.env.IMAP_USER || 'info@ringdom.org',
    password: process.env.IMAP_PASSWORD || '',
    smtp: {
      host: process.env.SMTP_HOST || 'mail.ringdom.org',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'noreply@ring-platform.org',
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
      },
    },
    polling: {
      interval: parseInt(process.env.EMAIL_POLLING_INTERVAL || '30000', 10),
      batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10),
    },
    mailbox: process.env.EMAIL_MAILBOX || 'INBOX',
    processedFolder: process.env.EMAIL_PROCESSED_FOLDER || 'Processed',
    spamFolder: process.env.EMAIL_SPAM_FOLDER || 'Spam',
  }
  return {
    id: 'primary',
    name: 'Primary',
    flow: 'standard',
    config,
  }
}

/** Resolve enabled CRM channels from ring-config (or legacy IMAP_*). */
export function loadCrmChannels(): ResolvedCrmChannel[] {
  try {
    const snapshot = getSystemConfigSnapshot()
    const emailCrm = snapshot.emailCrm
    if (emailCrm?.enabled === false) {
      return []
    }
    const configured = emailCrm?.channels
    if (configured && configured.length > 0) {
      return configured
        .filter((ch) => ch.enabled !== false && ch.imap?.host && ch.imap?.user)
        .map((ch) => ({
          id: ch.id,
          name: ch.name || ch.id,
          flow: (ch.flow || 'standard') as ChannelFlow,
          config: channelToEmailConfig(ch),
        }))
    }
  } catch {
    /* fall through to legacy */
  }
  return [legacyPrimaryChannel()]
}

/** Primary (first) CRM channel config — prefer over module-load singleton. */
export function getPrimaryEmailConfig(): EmailConfig {
  const channels = loadCrmChannels()
  return channels[0]?.config || legacyPrimaryChannel().config
}

/** @deprecated Prefer getPrimaryEmailConfig() — evaluated at call time via getter semantics in consumers. */
export const emailConfig: EmailConfig = legacyPrimaryChannel().config

export function getChannelById(channelId: string | undefined | null): ResolvedCrmChannel | null {
  if (!channelId) return null
  return loadCrmChannels().find((c) => c.id === channelId) || null
}

export function validateEmailConfig(config: EmailConfig = getPrimaryEmailConfig()): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!config.password) errors.push('IMAP password missing (CRM_CHANNEL_*_PASSWORD or IMAP_PASSWORD)')
  if (!config.host) errors.push('IMAP host is required')
  if (!config.user) errors.push('IMAP user is required')
  return { valid: errors.length === 0, errors }
}

export function validateCrmChannels(channels: ResolvedCrmChannel[] = loadCrmChannels()): {
  valid: boolean
  errors: string[]
} {
  if (channels.length === 0) {
    return { valid: false, errors: ['No CRM channels enabled'] }
  }
  const errors: string[] = []
  for (const ch of channels) {
    const check = validateEmailConfig(ch.config)
    if (!check.valid) {
      errors.push(...check.errors.map((e) => `[${ch.id}] ${e}`))
    }
  }
  return { valid: errors.length === 0, errors }
}

export default emailConfig
