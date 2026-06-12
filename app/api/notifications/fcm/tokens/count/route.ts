import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'

type FcmTokenRow = Record<string, unknown> & { id: string }

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  }
  return new Date()
}

export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get count of active tokens for the user
    const result = await db().queryDocs<FcmTokenRow>({
      collection: 'fcm_tokens',
      filters: [
        { field: 'userId', operator: '==', value: session.user.id },
        { field: 'isActive', operator: '==', value: true }
      ]
    })

    if (!result.success) {
      throw result.error || new Error('Failed to fetch fcm_tokens')
    }

    const count = result.data.length

    // Get device breakdown
    const devices = result.data.map((doc) => {
      const deviceInfo = doc.deviceInfo as Record<string, unknown> | undefined
      return {
        platform: (deviceInfo?.platform as string) || 'Unknown',
        browser: (deviceInfo?.browser as string) || 'Unknown',
        lastSeen: toDate(deviceInfo?.lastSeen),
        createdAt: toDate(doc.createdAt)
      }
    })

    return NextResponse.json({
      count,
      devices,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting FCM token count:', error)
    return NextResponse.json(
      { error: 'Failed to get token count' },
      { status: 500 }
    )
  }
}
