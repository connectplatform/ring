/**
 * Telegram Login Widget Callback Route
 * 
 * Verifies the Telegram Login Widget authorization hash and links
 * the Telegram account to the Ring user's profile.
 * 
 * Truth Lens:
 * - @legiox/telegram_login_widget_specialist
 * 
 * Security:
 * 1. Server-side hash verification (SHA256(token) → HMAC-SHA256)
 * 2. auth_date replay protection (max 1 day)
 * 3. Session authentication required
 */
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import crypto from 'crypto'

const BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || ''
const MAX_AUTH_AGE_SECONDS = 86400 // 24 hours

interface TelegramAuthData {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}

function verifyTelegramHash(data: TelegramAuthData, botToken: string): boolean {
  // Build data_check_string: sorted key=value lines, no hash
  const fields: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (key === 'hash') continue
    if (value !== undefined && value !== null) {
      fields.push(`${key}=${value}`)
    }
  }
  fields.sort()
  const dataCheckString = fields.join('\n')

  // secret_key = SHA256(bot_token) as raw bytes
  const secretKey = crypto.createHash('sha256').update(botToken).digest()

  // computed_hash = hex(HMAC_SHA256(data_check_string, secret_key))
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  // Constant-time compare
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(data.hash)
  )
}

/**
 * GET /api/auth/telegram/callback
 * Handles Telegram Login Widget redirect callback
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of SSG — auth() reads headers/cookies
  try {
    // 1. Verify user is authenticated with Ring
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/login?error=telegram_auth_required', request.url)
      )
    }

    // 2. Extract Telegram auth data from query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    
    const authData: TelegramAuthData = {
      id: searchParams.id || '',
      first_name: searchParams.first_name,
      last_name: searchParams.last_name,
      username: searchParams.username,
      photo_url: searchParams.photo_url,
      auth_date: searchParams.auth_date || '0',
      hash: searchParams.hash || '',
    }

    if (!authData.id || !authData.hash) {
      return NextResponse.redirect(
        new URL('/profile?error=telegram_invalid_data', request.url)
      )
    }

    // 3. Check auth_date freshness (anti-replay)
    const authDate = parseInt(authData.auth_date, 10)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > MAX_AUTH_AGE_SECONDS) {
      return NextResponse.redirect(
        new URL('/profile?error=telegram_expired', request.url)
      )
    }

    // 4. Verify hash server-side
    if (!verifyTelegramHash(authData, BOT_TOKEN)) {
      return NextResponse.redirect(
        new URL('/profile?error=telegram_hash_mismatch', request.url)
      )
    }

    // 5. Save Telegram ID and username to user profile
    const { db } = await import('@/lib/database')
    const telegramUsername = authData.username || ''
    const telegramId = authData.id

    // Get current user data and merge communication field
    const userResult = await db().findDocById('users', session.user.id)
    const currentData = userResult.success && userResult.data ? userResult.data as any : {}

    const updateData = {
      communication: {
        ...(currentData.communication || {}),
        telegramUsername: telegramUsername || currentData.communication?.telegramUsername || '',
        telegramId: telegramId,
        telegramLinkedAt: new Date().toISOString(),
      },
    }

    await db().updateDoc('users', session.user.id, updateData)

    // 6. Redirect back to profile with success
    return NextResponse.redirect(
      new URL('/profile?telegram=linked', request.url)
    )
  } catch (error) {
    console.error('[TELEGRAM CALLBACK] Error:', error)
    return NextResponse.redirect(
      new URL('/profile?error=telegram_server_error', request.url)
    )
  }
}
