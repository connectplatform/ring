'use server'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { normalizeToE164 } from '@/lib/phone/e164'
import {
  sendPhoneOtp,
  verifyPhoneOtpCode,
} from '@/features/auth/services/phone-otp-delivery'
import {
  insertPhoneLoginToken,
  markPhoneChallengeUsed,
  getOpenPhoneChallengeByRequestId,
} from '@/features/auth/services/phone-login-tokens'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

export type PhoneVerificationState = {
  provider: 'telegram_gateway' | 'whatsapp' | 'sms_fallback'
  requestId: string
  status: 'pending' | 'sent' | 'verified' | 'failed' | 'expired'
  attempts: number
  expiresAt: string
  phone: string
}

const MAX_ATTEMPTS = 5
const OTP_TTL_MS = 180_000

function challengeExpiresAt(): string {
  return new Date(Date.now() + OTP_TTL_MS).toISOString()
}

/**
 * Start GSM OTP for the authenticated user.
 * Primary: Telegram Gateway via shared PhoneOtpDelivery.
 */
export async function startPhoneOtp(rawPhone: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Authentication required' }
  }

  const phone = normalizeToE164(rawPhone)
  if (!phone) {
    return { success: false as const, error: 'Invalid phone number (use E.164 / UA mobile)' }
  }

  const sent = await sendPhoneOtp({ phone })
  if (sent.ok === false) {
    logger.warn('PhoneOTP: delivery failed', {
      userId: session.user.id,
      error: sent.error,
      fallbackNeeded: sent.fallbackNeeded,
    })
    return {
      success: false as const,
      error: sent.error,
      fallbackNeeded: sent.fallbackNeeded,
    }
  }

  // WA self-issued codes need phone_login_tokens.code_hash for verifyPhoneOtpCode
  if (sent.channel === 'whatsapp') {
    if (!sent.rawCode?.trim()) {
      logger.error('PhoneOTP: WhatsApp send missing rawCode — refusing challenge', {
        userId: session.user.id,
      })
      return {
        success: false as const,
        error: 'Could not send code. Try again shortly.',
      }
    }
    await insertPhoneLoginToken({
      phone: sent.phone,
      requestId: sent.requestId,
      channel: 'whatsapp',
      userId: session.user.id,
      expiresIn: '3 minutes',
      rawCode: sent.rawCode,
    })
  }

  const verification: PhoneVerificationState = {
    provider: sent.channel === 'whatsapp' ? 'whatsapp' : 'telegram_gateway',
    requestId: sent.requestId,
    status: 'sent',
    attempts: 0,
    expiresAt: challengeExpiresAt(),
    phone: sent.phone,
  }

  const patch = {
    phone: sent.phone,
    phoneNumber: sent.phone,
    phoneVerifiedAt: null,
    phoneVerification: verification,
    updatedAt: new Date().toISOString(),
  }

  const result = await db().updateDoc('users', session.user.id, patch)
  if (!result.success) {
    return { success: false as const, error: 'Failed to store verification challenge' }
  }

  return {
    success: true as const,
    phone: sent.phone,
    provider: verification.provider,
    expiresAt: verification.expiresAt,
  }
}

/**
 * Confirm OTP; on code_valid bind phone + phoneVerifiedAt.
 */
export async function confirmPhoneOtp(code: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Authentication required' }
  }

  const cleaned = String(code || '').replace(/\D/g, '')
  if (cleaned.length < 4 || cleaned.length > 8) {
    return { success: false as const, error: 'Invalid code' }
  }

  const user = await db().findDocById<Record<string, unknown>>('users', session.user.id)
  if (!user.success || !user.data) {
    return { success: false as const, error: 'User not found' }
  }

  const verification = user.data.phoneVerification as PhoneVerificationState | undefined
  if (!verification?.requestId || !verification.phone) {
    return { success: false as const, error: 'No pending phone verification' }
  }

  if (verification.expiresAt && new Date(verification.expiresAt).getTime() < Date.now()) {
    return { success: false as const, error: 'Code expired — request a new one' }
  }

  if ((verification.attempts ?? 0) >= MAX_ATTEMPTS) {
    return { success: false as const, error: 'Too many attempts — request a new code' }
  }

  const channel =
    verification.provider === 'whatsapp'
      ? 'whatsapp'
      : verification.provider === 'sms_fallback'
        ? 'sms_stub'
        : 'telegram_gateway'

  const checked = await verifyPhoneOtpCode({
    requestId: verification.requestId,
    code: cleaned,
    channel,
  })

  const attempts = (verification.attempts ?? 0) + 1

  if (checked.ok === false) {
    await db().updateDoc('users', session.user.id, {
      phoneVerification: {
        ...verification,
        attempts,
        status: checked.status === 'expired' ? 'expired' : 'failed',
      },
    })
    return { success: false as const, error: checked.error }
  }

  if (channel === 'whatsapp') {
    const row = await getOpenPhoneChallengeByRequestId(verification.requestId)
    if (row?.id) await markPhoneChallengeUsed(row.id)
  }

  const now = new Date().toISOString()
  const result = await db().updateDoc('users', session.user.id, {
    phone: verification.phone,
    phoneNumber: verification.phone,
    phoneVerifiedAt: now,
    phoneVerification: {
      ...verification,
      attempts,
      status: 'verified',
    },
    updatedAt: now,
  })

  if (!result.success) {
    return { success: false as const, error: 'Failed to bind verified phone' }
  }

  revalidatePath('/profile')
  revalidatePath('/admin/users')

  return {
    success: true as const,
    phone: verification.phone,
    phoneVerifiedAt: now,
  }
}
