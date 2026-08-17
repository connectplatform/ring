/**
 * Shared phone OTP delivery surface — profile verify + passwordless login.
 * Rail order: Telegram Gateway → WhatsApp (env-gated, on TG fallback or when TG unset) → clear error (SMS stub).
 */
import 'server-only'

import {
  checkVerificationStatus,
  isTelegramGatewayConfigured,
  sendPhoneOtpViaGateway,
  type GatewayRequestStatus,
} from '@/features/auth/services/telegram-gateway-otp'
import {
  isWhatsAppCloudConfigured,
  sendPhoneOtpViaWhatsApp,
} from '@/features/auth/services/whatsapp-cloud-otp'
import {
  getOpenPhoneChallengeByRequestId,
  bumpPhoneChallengeAttempt,
  expirePhoneChallengeIfMaxAttempts,
  MAX_VERIFY_ATTEMPTS,
  type PhoneOtpChannel,
} from '@/features/auth/services/phone-login-tokens'
import { hmacOTP, verifyOTPTiming } from '@/lib/auth/email-tokens'
import { normalizeToE164 } from '@/lib/phone/e164'

export type PhoneDeliveryRail = PhoneOtpChannel

export type SendPhoneOtpResult =
  | {
      ok: true
      phone: string
      requestId: string
      channel: PhoneDeliveryRail
      /** Present for WhatsApp self-issued OTP — hash immediately; never log */
      rawCode?: string
    }
  | {
      ok: false
      error: string
      fallbackNeeded?: boolean
      channelAttempted?: PhoneDeliveryRail
    }

export type VerifyPhoneOtpResult =
  | {
      ok: true
      phone: string
      requestId: string
      status?: GatewayRequestStatus | { status: string }
    }
  | { ok: false; error: string; status?: string }

function isWhatsAppRailConfigured(): boolean {
  return isWhatsAppCloudConfigured()
}

export function whatsAppRailAvailable(): boolean {
  return isWhatsAppRailConfigured()
}

/**
 * Preferred rail only (exclusive). Runtime TG→WA fallback lives in sendPhoneOtp.
 */
export function selectPhoneDeliveryRail(opts?: {
  whatsappOptOut?: boolean
}): PhoneDeliveryRail | null {
  if (isTelegramGatewayConfigured()) return 'telegram_gateway'
  if (!opts?.whatsappOptOut && isWhatsAppRailConfigured()) return 'whatsapp'
  return null
}

async function sendViaWhatsApp(
  phone: string,
): Promise<SendPhoneOtpResult> {
  const sent = await sendPhoneOtpViaWhatsApp(phone)
  if (sent.ok === false) {
    return {
      ok: false,
      error: sent.error,
      fallbackNeeded: sent.fallbackNeeded,
      channelAttempted: 'whatsapp',
    }
  }
  return {
    ok: true,
    phone,
    requestId: sent.requestId,
    channel: 'whatsapp',
    rawCode: sent.rawCode,
  }
}

/**
 * Send OTP via preferred rail; on Telegram fallbackNeeded try WhatsApp once.
 */
export async function sendPhoneOtp(params: {
  phone: string
  whatsappOptOut?: boolean
}): Promise<SendPhoneOtpResult> {
  const phone = normalizeToE164(params.phone)
  if (!phone) {
    return { ok: false, error: 'Invalid phone number (use E.164 / UA mobile)' }
  }

  const optOut = Boolean(params.whatsappOptOut)
  const rail = selectPhoneDeliveryRail({ whatsappOptOut: optOut })
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
      if (
        sent.fallbackNeeded &&
        !optOut &&
        isWhatsAppRailConfigured()
      ) {
        return sendViaWhatsApp(phone)
      }
      return {
        ok: false,
        error: sent.fallbackNeeded
          ? optOut
            ? 'This number cannot receive Telegram OTP. WhatsApp was opted out; SMS is not enabled yet.'
            : 'This number cannot receive Telegram OTP. WhatsApp/SMS fallback is not available.'
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
    return sendViaWhatsApp(phone)
  }

  return {
    ok: false,
    error: 'SMS OTP stub — no classical SMS provider wired.',
    fallbackNeeded: true,
    channelAttempted: 'sms_stub',
  }
}

/** Verify user-entered code against Gateway API or WhatsApp code_hash. */
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

  if (channel === 'whatsapp') {
    const row = await getOpenPhoneChallengeByRequestId(params.requestId)
    if (!row?.code_hash || row.channel !== 'whatsapp') {
      return { ok: false, error: 'Invalid or expired code', status: 'expired' }
    }
    if (row.attempt_count >= MAX_VERIFY_ATTEMPTS) {
      return { ok: false, error: 'Too many attempts', status: 'code_max_attempts_exceeded' }
    }

    const expected = hmacOTP(cleaned, row.phone)
    if (!verifyOTPTiming(row.code_hash, expected)) {
      await bumpPhoneChallengeAttempt(row.id)
      await expirePhoneChallengeIfMaxAttempts(row.id)
      return { ok: false, error: 'Invalid code', status: 'code_invalid' }
    }

    return {
      ok: true,
      phone: row.phone,
      requestId: params.requestId,
      status: { status: 'code_valid' },
    }
  }

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
