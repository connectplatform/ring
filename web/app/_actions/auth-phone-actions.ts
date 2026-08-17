'use server'

import { headers } from 'next/headers'
import { normalizeToE164 } from '@/lib/phone/e164'
import { isValidPhoneNumber } from '@/lib/validation/phone'
import {
  assertPhoneUnderRateLimit,
  getLatestOpenPhoneChallenge,
  insertPhoneLoginToken,
  type PhoneOtpChannel,
} from '@/features/auth/services/phone-login-tokens'
import { sendPhoneOtp } from '@/features/auth/services/phone-otp-delivery'
import { ensurePhoneAuthUser } from '@/features/auth/services/ensure-phone-auth-user'
import { logger } from '@/lib/logger'

export type AuthPhoneActionState = {
  ok: boolean
  message: string
  step?: 'identifier' | 'otp'
  phone?: string
  challengeId?: string
  channelUsed?: 'telegram' | 'whatsapp' | 'email'
}

const GENERIC_SENT =
  'If that number can receive a code, we sent one. Enter it below.'

const RATE_LIMITED_NO_CHALLENGE =
  'Too many codes requested. Wait a few minutes, then try again.'

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    return fwd || h.get('x-real-ip') || null
  } catch {
    return null
  }
}

function channelBanner(channel: PhoneOtpChannel | string | undefined): 'telegram' | 'whatsapp' {
  return channel === 'whatsapp' ? 'whatsapp' : 'telegram'
}

/**
 * Request phone login OTP via Telegram Gateway (create account with virtual-email if new).
 * Rate-limited: reuse latest open challengeId — never advance to OTP without one.
 */
export async function requestPhoneLoginCode(
  _prev: AuthPhoneActionState | null,
  formData: FormData,
): Promise<AuthPhoneActionState> {
  const raw = String(formData.get('phone') || formData.get('identifier') || '').trim()
  const whatsappOptOut = String(formData.get('whatsappOptOut') || '') === '1'

  const e164 = normalizeToE164(raw)
  if (!e164 || !isValidPhoneNumber(e164)) {
    return {
      ok: false,
      message: 'Enter a valid phone number (E.164 or UA mobile).',
      step: 'identifier',
    }
  }

  try {
    const underLimit = await assertPhoneUnderRateLimit(e164)
    if (!underLimit) {
      const open = await getLatestOpenPhoneChallenge(e164)
      if (open?.request_id) {
        return {
          ok: true,
          message: GENERIC_SENT,
          step: 'otp',
          phone: e164,
          challengeId: open.request_id,
          channelUsed: channelBanner(open.channel),
        }
      }
      return {
        ok: false,
        message: RATE_LIMITED_NO_CHALLENGE,
        step: 'identifier',
        phone: e164,
      }
    }

    // Send first — avoid orphan virtual-email users when Gateway cannot deliver
    const sent = await sendPhoneOtp({ phone: e164, whatsappOptOut })
    if (sent.ok === false) {
      return {
        ok: false,
        message: sent.error,
        step: 'identifier',
        phone: e164,
      }
    }

    if (sent.channel === 'whatsapp' && !sent.rawCode?.trim()) {
      logger.error('[PhoneLogin] WhatsApp send missing rawCode — refusing challenge')
      return {
        ok: false,
        message: 'Could not send code. Try again shortly.',
        step: 'identifier',
        phone: e164,
      }
    }

    const user = await ensurePhoneAuthUser(e164, { markVerified: false })
    const ip = await clientIp()
    await insertPhoneLoginToken({
      phone: e164,
      requestId: sent.requestId,
      channel: sent.channel,
      userId: user.id,
      expiresIn: '3 minutes',
      ipAddress: ip,
      rawCode: sent.channel === 'whatsapp' ? sent.rawCode : undefined,
    })

    return {
      ok: true,
      message: GENERIC_SENT,
      step: 'otp',
      phone: e164,
      challengeId: sent.requestId,
      channelUsed: channelBanner(sent.channel),
    }
  } catch (error) {
    logger.error('[PhoneLogin] requestPhoneLoginCode failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      message: 'Could not send code. Try again shortly.',
      step: 'identifier',
    }
  }
}
