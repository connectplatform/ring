/**
 * Profile "Link Telegram" intent — bind OIDC callback to an already-signed-in Ring user.
 * Cookie is set before signIn('telegram') and consumed in the Auth.js signIn callback.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

export const TELEGRAM_LINK_COOKIE = 'ring.telegram_link'

const MAX_AGE_SEC = 10 * 60

function signingSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    'ring-telegram-link-dev'
  )
}

function sign(userId: string, exp: number): string {
  const payload = `${userId}.${exp}`
  const mac = createHmac('sha256', signingSecret()).update(payload).digest('base64url')
  return `${payload}.${mac}`
}

function verify(raw: string): string | null {
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [userId, expStr, mac] = parts
  const exp = Number(expStr)
  if (!userId || !Number.isFinite(exp) || Date.now() / 1000 > exp) return null
  const expected = createHmac('sha256', signingSecret())
    .update(`${userId}.${exp}`)
    .digest('base64url')
  try {
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return userId
}

/** Set link-intent cookie for the current session user (call before OIDC signIn). */
export async function setTelegramLinkIntent(userId: string): Promise<void> {
  const id = String(userId || '').trim()
  if (!id) throw new Error('setTelegramLinkIntent: userId required')
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  const jar = await cookies()
  jar.set(TELEGRAM_LINK_COOKIE, sign(id, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  })
}

/** Read + clear link-intent; returns Ring userId to attach Telegram to, or null. */
export async function consumeTelegramLinkIntent(): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get(TELEGRAM_LINK_COOKIE)?.value
  jar.delete(TELEGRAM_LINK_COOKIE)
  if (!raw) return null
  return verify(raw)
}
