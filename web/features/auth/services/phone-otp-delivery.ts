/**
 * Shared phone OTP delivery surface — profile verify + passwordless login.
 * Rail order: Telegram Gateway → WhatsApp (env-gated) → clear error (SMS stub).
 */
import 'server-only'

import {
  checkVerificationStatus,
  isTelegramGatewayConfigured,
  sendPhoneOtpViaGateway,
  type GatewayRequestStatus,
} from '@/features/auth/services/telegram-gateway-otp'
import { normalizeToE164 } from '@/lib/phone/e164'
import type { PhoneOtpChannel } from '@/features/auth/services/phone-login-tokens'

export type PhoneDeliveryRail = PhoneOtpChannel

export type SendPhoneOtpResult =
  | {
      ok: true
      phone: string
      requestId: string
      channel: PhoneDeliveryRail
    }
  | {
      ok: false
      error: string
      fallbackNeeded?: boolean
      channelAttempted?: PhoneDeliveryRail
    }

export type VerifyPhoneOtpResult =
  | { ok: true; phone: string; requestId: string; status: GatewayRequestStatus }
  | { ok: false; error: string; status?: string }

function isWhatsAppRailConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_TOKEN?.trim() &&
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_AUTH_TEMPLATE_NAME?.trim(),
  )
}

export function whatsAppRailAvailable(): boolean {
  return isWhatsAppRailConfigured()
}

/**
 * Select delivery rail.
 * WhatsApp opt-out skips WA even when configured.
 */
export function selectPhoneDeliveryRail(opts?: {
  whatsappOptOut?: boolean
}): PhoneDeliveryRail | null {
  if (isTelegramGatewayConfigured()) return 'telegram_gateway'
  if (!opts?.whatsappOptOut && isWhatsAppRailConfigured()) return 'whatsapp'
  return null
}

/**
 * Send OTP via selected rail. P1: Gateway only; WhatsApp returns gated error.
 */
export async function sendPhoneOtp(params: {
  phone: string
  whatsappOptOut?: boolean
}): Promise<SendPhoneOtpResult> {
  const phone = normalizeToE164(params.phone)
  if (!phone) {
    return { ok: false, error: 'Invalid phone number (use E.164 / UA mobile)' }
  }

  const rail = selectPhoneDeliveryRail({ whatsappOptOut: params.whatsappOptOut })
  if (!rail) {
    return {
      ok: false,
      error:
        'Phone OTP is not available. Configure TELEGRAM_GATEWAY_TOKEN (or WhatsApp Cloud auth template).',
      fallbackNeeded: true,
    }
  }

  if (rail === 'telegram_gateway') {
    const sent = await sendPhoneOtpViaGateway(phone)
    if (sent.ok === false) {
      return {
        ok: false,
        error: sent.fallbackNeeded
          ? 'This number cannot receive Telegram OTP. SMS fallback is not enabled yet.'
          : sent.error,
        fallbackNeeded: sent.fallbackNeeded,
        channelAttempted: 'telegram_gateway',
      }
    }
    return {
      ok: true,
      phone,
      requestId: sent.requestId,
      channel: 'telegram_gateway',
    }
  }

  if (rail === 'whatsapp') {
    return {
      ok: false,
      error: 'WhatsApp OTP rail is configured but not enabled in this build yet.',
      fallbackNeeded: true,
      channelAttempted: 'whatsapp',
    }
  }

  return {
    ok: false,
    error: 'SMS OTP stub — no classical SMS provider wired.',
    fallbackNeeded: true,
    channelAttempted: 'sms_stub',
  }
}

/** Verify user-entered code against Gateway (or future rails) via request_id. */
export async function verifyPhoneOtpCode(params: {
  requestId: string
  code: string
  channel?: PhoneDeliveryRail
}): Promise<VerifyPhoneOtpResult> {
  const cleaned = String(params.code || '').replace(/\D/g, '')
  if (cleaned.length < 4 || cleaned.length > 8) {
    return { ok: false, error: 'Invalid code' }
  }

  const channel = params.channel ?? 'telegram_gateway'
  if (channel !== 'telegram_gateway') {
    return { ok: false, error: `OTP verify not implemented for channel ${channel}` }
  }

  const checked = await checkVerificationStatus({
    requestId: params.requestId,
    code: cleaned,
  })

  if (checked.ok === false) {
    return { ok: false, error: checked.error }
  }

  const status = checked.result.verification_status?.status
  if (status !== 'code_valid') {
    return {
      ok: false,
      error:
        status === 'code_max_attempts_exceeded'
          ? 'Too many attempts'
          : status === 'expired'
            ? 'Code expired'
            : 'Invalid code',
      status: status ? String(status) : undefined,
    }
  }

  return {
    ok: true,
    phone: checked.result.phone_number || '',
    requestId: params.requestId,
    status: checked.result,
  }
}
