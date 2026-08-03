/**
 * Telegram Login Widget Callback Route
 *
 * Verifies the Telegram Login Widget authorization hash and links
 * the Telegram account to the Ring user's profile (already logged in).
 *
 * Truth Lens:
 * - @legiox/telegram_login_widget_specialist
 *
 * Security:
 * 1. Server-side hash verification (SHA256(token) → HMAC-SHA256)
 * 2. auth_date replay protection (max 1 day)
 * 3. Session authentication required
 *
 * Note: Unauthenticated “Login via Telegram” uses Auth.js OIDC
 * (`signIn('telegram')` → /api/auth/callback/telegram). This route is
 * legacy widget linking only.
 */
import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getTelegramLoginBotToken,
  normalizeTelegramAccountId,
} from '@/lib/auth/telegram-oidc'
import {
  isTelegramWidgetAuthDateFresh,
  TELEGRAM_WIDGET_MAX_AUTH_AGE_SECONDS,
  verifyTelegramLoginWidgetHash,
  type TelegramWidgetAuthPayload,
} from '@/lib/auth/telegram-login-widget-hash'
import {
  ensureTelegramAccountLinked,
  syncUserTelegramCommunication,
} from '@/features/auth/services/user-resolve'

/**
 * GET /api/auth/telegram/callback
 * Handles Telegram Login Widget redirect callback (profile linking).
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of SSG — auth() reads headers/cookies
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/login?error=telegram_auth_required', request.url),
      )
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    const authData: TelegramWidgetAuthPayload = {
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
        new URL('/profile?error=telegram_invalid_data', request.url),
      )
    }

    if (!isTelegramWidgetAuthDateFresh(authData.auth_date, TELEGRAM_WIDGET_MAX_AUTH_AGE_SECONDS)) {
      return NextResponse.redirect(
        new URL('/profile?error=telegram_expired', request.url),
      )
    }

    const botToken = getTelegramLoginBotToken()
    if (!botToken) {
      console.error('[TELEGRAM CALLBACK] ADMIN_BOT_TOKEN / TELEGRAM_LOGIN_BOT_TOKEN missing')
      return NextResponse.redirect(
        new URL('/profile?error=telegram_server_error', request.url),
      )
    }

    if (!verifyTelegramLoginWidgetHash(authData, botToken)) {
      console.warn('[TELEGRAM CALLBACK] hash mismatch (token redacted)')
      return NextResponse.redirect(
        new URL('/profile?error=telegram_hash_mismatch', request.url),
      )
    }

    const telegramId = normalizeTelegramAccountId(authData.id)
    const telegramUsername = authData.username || ''

    try {
      await syncUserTelegramCommunication({
        userId: session.user.id,
        telegramId,
        telegramUsername,
      })
    } catch (syncError) {
      const msg = syncError instanceof Error ? syncError.message : String(syncError)
      if (msg.includes('already linked')) {
        return NextResponse.redirect(
          new URL('/profile?error=telegram_already_linked', request.url),
        )
      }
      throw syncError
    }

    // Best-effort Auth.js accounts row so OIDC login can find the same identity later
    try {
      await ensureTelegramAccountLinked({
        userId: session.user.id,
        providerAccountId: telegramId,
      })
    } catch (linkError) {
      console.warn('[TELEGRAM CALLBACK] accounts link skipped:', linkError)
    }

    return NextResponse.redirect(
      new URL('/profile?telegram=linked', request.url),
    )
  } catch (error) {
    console.error('[TELEGRAM CALLBACK] Error:', error)
    return NextResponse.redirect(
      new URL('/profile?error=telegram_server_error', request.url),
    )
  }
}
