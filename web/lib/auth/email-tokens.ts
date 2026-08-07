/**
 * CSPRNG token helpers for Ring Mailer email auth (OTP + magic links).
 * Never store raw tokens — only hashes.
 */
import 'server-only'

import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export type EmailFlowType =
  | 'otp_code'
  | 'magic_link'
  | 'email_verify'
  | 'password_reset'

function otpHmacSecret(): string {
  const secret = process.env.OTP_HMAC_SECRET || process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('OTP_HMAC_SECRET or AUTH_SECRET (min 16 chars) required for email tokens')
  }
  return secret
}

/** 6-digit numeric OTP as string (leading zeros preserved). */
export function generateOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Opaque URL-safe magic token (~32 bytes). */
export function generateMagicToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(raw: string): string {
  return createHmac('sha256', otpHmacSecret()).update(raw).digest('hex')
}

export function hmacOTP(code: string, email: string): string {
  const normalized = `${email.trim().toLowerCase()}:${code.trim()}`
  return createHmac('sha256', otpHmacSecret()).update(normalized).digest('hex')
}

/** Timing-safe compare of two hex digests (or equal-length utf8 strings). */
export function verifyOTPTiming(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function buildMagicLinkUrl(token: string, path = '/verify'): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  const origin = base.replace(/\/$/, '')
  // Hash fragment: email scanners must not auto-GET-consume the token
  return `${origin}${path}#token=${encodeURIComponent(token)}`
}
