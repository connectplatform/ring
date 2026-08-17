/**
 * WhatsApp Cloud API authentication-template OTP client (identity rail).
 * Self-issued codes via generateOTP(); Meta delivers COPY_CODE AUTH template.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/auth-otp-template-messages/
 */
import 'server-only'

import { randomUUID } from 'node:crypto'
import { generateOTP } from '@/lib/auth/email-tokens'
import { logger } from '@/lib/logger'

const DEFAULT_GRAPH_VERSION = 'v21.0'

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_TOKEN?.trim() &&
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_AUTH_TEMPLATE_NAME?.trim(),
  )
}

function graphVersion(): string {
  return process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION
}

function templateLanguage(): string {
  return process.env.WHATSAPP_AUTH_TEMPLATE_LANG?.trim() || 'en_US'
}

/** Meta Cloud API expects digits only (no leading +). */
export function toWhatsAppRecipient(e164: string): string {
  return e164.replace(/\D/g, '')
}

type GraphErrorBody = {
  error?: {
    message?: string
    code?: number
    error_data?: { details?: string }
  }
}

type GraphSendSuccess = {
  messaging_product?: string
  contacts?: Array<{ wa_id?: string }>
  messages?: Array<{ id?: string }>
}

function mapGraphError(code: number | undefined, message: string): {
  error: string
  fallbackNeeded: boolean
} {
  // 131026 undeliverable / no WhatsApp; 131026-class delivery failures → fallback
  if (code === 131026 || code === 131047) {
    return {
      error: 'This number cannot receive WhatsApp OTP right now.',
      fallbackNeeded: true,
    }
  }
  if (code === 132001) {
    return {
      error: 'WhatsApp auth template is missing or not approved for this language.',
      fallbackNeeded: true,
    }
  }
  if (code === 132000) {
    return {
      error: 'WhatsApp auth template parameter mismatch.',
      fallbackNeeded: true,
    }
  }
  return {
    error: message || 'WhatsApp Cloud API send failed',
    fallbackNeeded: true,
  }
}

/**
 * Generate 6-digit OTP, send AUTHENTICATION COPY_CODE template, return rawCode
 * for immediate hashing by the caller (never log rawCode).
 */
export async function sendPhoneOtpViaWhatsApp(phoneE164: string): Promise<
  | { ok: true; requestId: string; rawCode: string; provider: 'whatsapp' }
  | { ok: false; error: string; fallbackNeeded?: boolean }
> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim()
  const templateName = process.env.WHATSAPP_AUTH_TEMPLATE_NAME?.trim()

  if (!token || !phoneNumberId || !templateName) {
    return { ok: false, error: 'WhatsApp Cloud OTP not configured', fallbackNeeded: true }
  }

  const to = toWhatsAppRecipient(phoneE164)
  if (!to || to.length < 8) {
    return { ok: false, error: 'Invalid phone for WhatsApp', fallbackNeeded: false }
  }

  const rawCode = generateOTP()
  const languageCode = templateLanguage()
  const url = `https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: rawCode }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: rawCode }],
        },
      ],
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => null)) as
      | (GraphSendSuccess & GraphErrorBody)
      | null

    if (!res.ok) {
      const code = json?.error?.code
      const msg =
        json?.error?.error_data?.details ||
        json?.error?.message ||
        `HTTP ${res.status}`
      logger.warn('WhatsAppCloud: send failed', { code, msg })
      const mapped = mapGraphError(code, msg)
      return { ok: false, ...mapped }
    }

    const wamid = json?.messages?.[0]?.id?.trim()
    const requestId = wamid || `wa_${randomUUID()}`

    return {
      ok: true,
      requestId,
      rawCode,
      provider: 'whatsapp',
    }
  } catch (error) {
    logger.error('WhatsAppCloud: request failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'WhatsApp request failed',
      fallbackNeeded: true,
    }
  }
}
