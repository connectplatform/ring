'use server'

import { headers } from 'next/headers'
import { auth } from '@/auth'
import { render } from '@react-email/render'
import { OTPEmail } from '@/emails/OTPEmail'
import { isRingMailerConfigured, sendMail } from '@/lib/mailer'
import { generateOTP } from '@/lib/auth/email-tokens'
import {
  assertUnderRateLimit,
  insertEmailToken,
} from '@/features/auth/services/email-login-tokens'
import {
  findUserByEmail,
  normalizeAuthEmail,
} from '@/features/auth/services/user-resolve'
import { isVirtualEmail } from '@/lib/auth/virtual-email'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

export type LinkEmailActionState = {
  ok: boolean
  message: string
  step?: 'email' | 'otp' | 'done'
  email?: string
}

const GENERIC_SENT =
  'If that address can receive mail, we sent a code. Check your inbox.'

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    return fwd || h.get('x-real-ip') || null
  } catch {
    return null
  }
}

function appName(): string {
  return process.env.NEXT_PUBLIC_BRAND_NAME || 'Ring Platform'
}

/**
 * Authenticated: send Ring Mailer OTP to a real email to replace virtual-email.
 * Collision policy: deny if another user already owns the address.
 */
export async function requestLinkEmailCode(
  _prev: LinkEmailActionState | null,
  formData: FormData,
): Promise<LinkEmailActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'Sign in required.', step: 'email' }
  }

  const email = normalizeAuthEmail(String(formData.get('email') || ''))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email address.', step: 'email' }
  }

  if (isVirtualEmail(email)) {
    return {
      ok: false,
      message: 'That address cannot be used. Enter a real email inbox.',
      step: 'email',
    }
  }

  if (!isRingMailerConfigured()) {
    return {
      ok: false,
      message: 'Email linking is not configured. Set SMTP_* or EMAIL_MODE=ethereal.',
      step: 'email',
    }
  }

  const owner = await findUserByEmail(email)
  if (owner && owner.id !== session.user.id) {
    return {
      ok: false,
      message: 'This email is already linked to another account. Contact support to merge.',
      step: 'email',
    }
  }

  try {
    const underLimit = await assertUnderRateLimit(email)
    if (!underLimit) {
      return { ok: true, message: GENERIC_SENT, step: 'otp', email }
    }

    const code = generateOTP()
    const ip = await clientIp()
    await insertEmailToken({
      email,
      rawToken: code,
      flowType: 'email_verify',
      userId: session.user.id,
      expiresIn: '10 minutes',
      ipAddress: ip,
      otpStyle: true,
    })

    const html = await render(
      OTPEmail({
        code,
        userName: session.user.name || undefined,
        appName: appName(),
        expiresInMinutes: 10,
      }),
    )
    await sendMail({
      to: email,
      subject: `${appName()} — confirm your email`,
      text: `Your confirmation code is ${code}. It expires in 10 minutes.`,
      html,
    })
  } catch (error) {
    logger.error('[LinkEmail] requestLinkEmailCode failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { ok: true, message: GENERIC_SENT, step: 'otp', email }
}

/**
 * Authenticated: verify OTP and replace virtual-email with the real address.
 */
export async function confirmLinkEmail(
  _prev: LinkEmailActionState | null,
  formData: FormData,
): Promise<LinkEmailActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, message: 'Sign in required.', step: 'email' }
  }

  const email = normalizeAuthEmail(String(formData.get('email') || ''))
  const code = String(formData.get('code') || '').trim()
  if (!email || !code) {
    return { ok: false, message: 'Email and code are required.', step: 'otp', email }
  }

  // consumeOtpCode only reads flow_type=otp_code — use dedicated email_verify consume path
  const { getSharedPgPool } = await import('@/lib/database/shared-pg-pool')
  const { hmacOTP, verifyOTPTiming } = await import('@/lib/auth/email-tokens')
  const normalized = normalizeAuthEmail(email)
  const tokenHash = hmacOTP(code, normalized)
  const pg = await getSharedPgPool()

  const pending = await pg.query<{
    id: string
    user_id: string | null
    attempt_count: number
    token_hash: string
  }>(
    `SELECT id, user_id, attempt_count, token_hash
     FROM email_login_tokens
     WHERE email = $1 AND flow_type = 'email_verify' AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized],
  )
  const row = pending.rows[0]
  if (!row) {
    return { ok: false, message: 'Code expired or invalid.', step: 'otp', email }
  }
  if (row.user_id && row.user_id !== session.user.id) {
    return { ok: false, message: 'Code does not match this session.', step: 'otp', email }
  }
  if (row.attempt_count >= 5) {
    await pg.query(`UPDATE email_login_tokens SET used_at = NOW() WHERE id = $1`, [row.id])
    return { ok: false, message: 'Too many attempts. Request a new code.', step: 'email', email }
  }
  if (!verifyOTPTiming(row.token_hash, tokenHash)) {
    await pg.query(
      `UPDATE email_login_tokens SET attempt_count = attempt_count + 1 WHERE id = $1`,
      [row.id],
    )
    return { ok: false, message: 'Invalid code.', step: 'otp', email }
  }

  await pg.query(
    `UPDATE email_login_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
    [row.id],
  )

  const owner = await findUserByEmail(normalized)
  if (owner && owner.id !== session.user.id) {
    return {
      ok: false,
      message: 'This email is already linked to another account. Contact support to merge.',
      step: 'email',
      email,
    }
  }

  const result = await db().updateDoc('users', session.user.id, {
    email: normalized,
    emailVerified: new Date(),
    isVerified: true,
    emailKind: 'real',
    isVirtualEmail: false,
    updatedAt: new Date(),
  })
  if (!result.success) {
    return { ok: false, message: 'Could not link email. Try again.', step: 'otp', email }
  }

  revalidatePath('/profile')
  return {
    ok: true,
    message: 'Email linked successfully.',
    step: 'done',
    email: normalized,
  }
}
