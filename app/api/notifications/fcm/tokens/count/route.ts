import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  listActiveFcmTokensForUser,
  summarizeFcmTokenDevices,
} from '@/lib/notifications/fcm-token-db'

export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const result = await listActiveFcmTokensForUser(session.user.id)

    const payload: {
      count: number
      devices: ReturnType<typeof summarizeFcmTokenDevices>
      schemaReady: boolean
      warning?: string
      lastUpdated: string
    } = {
      count: result.tokens.length,
      devices: summarizeFcmTokenDevices(result.tokens),
      schemaReady: result.schemaReady,
      lastUpdated: new Date().toISOString(),
    }

    if (result.schemaReady === false) {
      payload.warning = result.warning
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error getting FCM token count:', error)
    return NextResponse.json(
      { error: 'Failed to get token count' },
      { status: 500 }
    )
  }
}
