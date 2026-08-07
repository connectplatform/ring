import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  unregisterFcmTokenForUser,
  upsertFcmTokenForUser,
} from '@/lib/notifications/fcm-token-db'
import { checkFcmRegisterRateLimit } from '@/lib/notifications/rate-limit-fcm-register'

/**
 * Non-React FCM token registration (rate-limited).
 * React apps should use Server Action `upsertFcmToken` from `app/_actions/fcm.ts`.
 */
export async function POST(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rate = checkFcmRegisterRateLimit(session.user.id)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: rate.retryAfterSeconds
            ? { 'Retry-After': String(rate.retryAfterSeconds) }
            : undefined,
        },
      )
    }

    const body = await req.json()
    const result = await upsertFcmTokenForUser(session.user.id, {
      token: body.token,
      deviceFingerprint: body.deviceFingerprint,
      deviceInfo: body.deviceInfo,
      platform: body.platform ?? 'web',
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error registering FCM token:', error)
    return NextResponse.json({ error: 'Failed to register FCM token' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const result = await unregisterFcmTokenForUser(session.user.id, {
      deviceFingerprint: body.deviceFingerprint,
      token: body.token,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing FCM token:', error)
    return NextResponse.json({ error: 'Failed to remove FCM token' }, { status: 500 })
  }
}
