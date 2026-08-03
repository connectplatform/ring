'use server'

import { headers } from 'next/headers'
import { render } from '@react-email/render'
import { OTPEmail } from '@/emails/OTPEmail'
import { MagicLinkEmail } from '@/emails/MagicLinkEmail'
import { isRingMailerConfigured, sendMail } from '@/lib/mailer'
import {
  buildMagicLinkUrl,
  generateMagicToken,
  generateOTP,
  hashPassword,
} from '@/lib/auth/email-tokens'
import {
  assertUnderRateLimit,
  insertEmailToken,
} from '@/features/auth/services/email-login-tokens'
import {
  findUserByEmail,
  normalizeAuthEmail,
} from '@/features/auth/services/user-resolve'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export type AuthEmailActionState = {
  ok: boolean
  message: string
  step?: 'email' | 'otp' | 'sent'
  email?: string
}

const GENERIC_SENT =
  'If that address can receive mail, we sent a code or link. Check your inbox.'

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
 * Request a 6-digit OTP for passwordless sign-in.
 * Always returns the same message (no email enumeration).
 */
export async function requestLoginCode(
  _prev: AuthEmailActionState | null,
  formData: FormData,
): Promise<AuthEmailActionState> {
  const email = normalizeAuthEmail(String(formData.get('email') || ''))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email address.', step: 'email' }
  }

  if (!isRingMailerConfigured()) {
    return {
      ok: false,
      message: 'Email sign-in is not configured. Set SMTP_* or EMAIL_MODE=ethereal.',
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
      flowType: 'otp_code',
      expiresIn: '10 minutes',
      ipAddress: ip,
      otpStyle: true,
    })

    const user = await findUserByEmail(email)
    const html = await render(
      OTPEmail({
        code,
        userName: user?.name ? String(user.name) : undefined,
        appName: appName(),
        expiresInMinutes: 10,
      }),
    )
    await sendMail({
      to: email,
      subject: `${appName()} sign-in code`,
      text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
      html,
    })
  } catch (error) {
    logger.error('[RingMailer] requestLoginCode failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { ok: true, message: GENERIC_SENT, step: 'otp', email }
}

/**
 * Request a magic-link email (hash-fragment /verify#token=…).
 */
export async function requestMagicLink(
  _prev: AuthEmailActionState | null,
  formData: FormData,
): Promise<AuthEmailActionState> {
  const email = normalizeAuthEmail(String(formData.get('email') || ''))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email address.', step: 'email' }
  }

  if (!isRingMailerConfigured()) {
    return {
      ok: false,
      message: 'Email sign-in is not configured. Set SMTP_* or EMAIL_MODE=ethereal.',
      step: 'email',
    }
  }

  try {
    const underLimit = await assertUnderRateLimit(email)
    if (!underLimit) {
      return { ok: true, message: GENERIC_SENT, step: 'sent', email }
    }

    const token = generateMagicToken()
    const ip = await clientIp()
    await insertEmailToken({
      email,
      rawToken: token,
      flowType: 'magic_link',
      expiresIn: '30 minutes',
      ipAddress: ip,
    })

    const loginUrl = buildMagicLinkUrl(token, '/verify')
    const user = await findUserByEmail(email)
    const html = await render(
      MagicLinkEmail({
        loginUrl,
        userName: user?.name ? String(user.name) : undefined,
        appName: appName(),
        expiresInMinutes: 30,
        purpose: 'login',
      }),
    )
    await sendMail({
      to: email,
      subject: `Sign in to ${appName()}`,
      text: `Sign in: ${loginUrl}\nThis link expires in 30 minutes.`,
      html,
    })
  } catch (error) {
    logger.error('[RingMailer] requestMagicLink failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { ok: true, message: GENERIC_SENT, step: 'sent', email }
}

/**
 * Forgot password — sends password_reset magic link (same generic response).
 */
export async function requestPasswordReset(
  _prev: AuthEmailActionState | null,
  formData: FormData,
): Promise<AuthEmailActionState> {
  const email = normalizeAuthEmail(String(formData.get('email') || ''))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Enter a valid email address.', step: 'email' }
  }

  if (!isRingMailerConfigured()) {
    return {
      ok: false,
      message: 'Email reset is not configured.',
      step: 'email',
    }
  }

  try {
    const underLimit = await assertUnderRateLimit(email)
    if (underLimit) {
      const user = await findUserByEmail(email)
      if (user) {
        const token = generateMagicToken()
        const ip = await clientIp()
        await insertEmailToken({
          email,
          rawToken: token,
          flowType: 'password_reset',
          userId: user.id,
          expiresIn: '30 minutes',
          ipAddress: ip,
        })
        const loginUrl = buildMagicLinkUrl(token, '/reset-password')
        const html = await render(
          MagicLinkEmail({
            loginUrl,
            userName: user.name ? String(user.name) : undefined,
            appName: appName(),
            expiresInMinutes: 30,
            purpose: 'reset',
          }),
        )
        await sendMail({
          to: email,
          subject: `Reset your ${appName()} password`,
          text: `Reset password: ${loginUrl}\nExpires in 30 minutes.`,
          html,
        })
      }
    }
  } catch (error) {
    logger.error('[RingMailer] requestPasswordReset failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return { ok: true, message: GENERIC_SENT, step: 'sent', email }
}

/**
 * Complete password reset after magic token was validated client-side via
 * signIn('email-magic') with flow password_reset — or set password with token in form.
 */
export async function completePasswordReset(
  _prev: AuthEmailActionState | null,
  formData: FormData,
): Promise<AuthEmailActionState> {
  const token = String(formData.get('token') || '').trim()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  if (!token) {
    return { ok: false, message: 'Missing reset token.', step: 'email' }
  }
  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.', step: 'email' }
  }
  if (password !== confirm) {
    return { ok: false, message: 'Passwords do not match.', step: 'email' }
  }

  const { consumeMagicToken } = await import('@/features/auth/services/email-login-tokens')
  const consumed = await consumeMagicToken({
    rawToken: token,
    flowTypes: ['password_reset'],
  })
  if (!consumed) {
    return { ok: false, message: 'Reset link expired or already used.', step: 'email' }
  }

  const user = await findUserByEmail(consumed.email)
  if (!user) {
    return { ok: false, message: 'Account not found.', step: 'email' }
  }

  const passwordHash = await hashPassword(password)
  const result = await db().updateDoc('users', user.id, {
    passwordHash,
    emailVerified: new Date(),
    isVerified: true,
    updatedAt: new Date(),
  })
  if (!result.success) {
    return { ok: false, message: 'Could not update password. Try again.', step: 'email' }
  }

  return {
    ok: true,
    message: 'Password updated. You can sign in with email and password.',
    step: 'sent',
    email: consumed.email,
  }
}

export async function ringMailerStatus(): Promise<{ configured: boolean }> {
  return { configured: isRingMailerConfigured() }
}
