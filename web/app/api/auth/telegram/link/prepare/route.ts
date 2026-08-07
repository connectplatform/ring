import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { setTelegramLinkIntent } from '@/lib/auth/telegram-link-intent'

/**
 * POST /api/auth/telegram/link/prepare
 * Marks the current session for Telegram OIDC account linking (profile Messengers tab).
 * Client then calls signIn('telegram') → Auth.js signIn attaches UID to this user.
 */
export async function POST() {
  await connection()
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    await setTelegramLinkIntent(userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[telegram/link/prepare]', error)
    return NextResponse.json({ error: 'Failed to prepare Telegram link' }, { status: 500 })
  }
}
