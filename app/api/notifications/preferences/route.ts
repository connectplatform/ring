import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@/features/notifications/services/notification-service'
import type { DetailedNotificationPreferences } from '@/features/notifications/types'

function defaultNotificationPreferences(
  enabled = true,
): Partial<DetailedNotificationPreferences> {
  return {
    enabled,
    channels: {
      inApp: enabled,
      email: enabled,
      sms: false,
      push: false,
    },
    language: 'en',
    updatedAt: new Date(),
  }
}

function preferencesResponse(
  preferences: Partial<DetailedNotificationPreferences>,
  status = 200,
) {
  return NextResponse.json(
    { success: true, data: preferences },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    },
  )
}

/**
 * GET /api/notifications/preferences
 */
export async function GET(_req: NextRequest) {
  await connection()

  console.log('API: /api/notifications/preferences - Starting GET request')

  try {
    const session = await auth()
    if (!session?.user) {
      console.log('API: /api/notifications/preferences - Unauthorized access attempt')
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('API: /api/notifications/preferences - User authenticated', {
      userId,
      role: session.user.role,
    })

    console.log('API: /api/notifications/preferences - Fetching preferences', { userId })
    const preferences = await getUserNotificationPreferences(userId)

    if (!preferences) {
      console.log('API: /api/notifications/preferences - No preferences found, returning defaults')
      return preferencesResponse(defaultNotificationPreferences(true))
    }

    console.log('API: /api/notifications/preferences - Preferences retrieved successfully')
    return preferencesResponse(preferences)
  } catch (error) {
    console.error('API: /api/notifications/preferences - Error occurred:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences. Please try again later.' },
      { status: 500 },
    )
  }
}

/**
 * PUT /api/notifications/preferences
 */
export async function PUT(req: NextRequest) {
  await connection()

  console.log('API: /api/notifications/preferences - Starting PUT request')

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const userId = session.user.id
    const data = await req.json()

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences data provided.' }, { status: 400 })
    }

    console.log('API: /api/notifications/preferences - Updating preferences', { userId })
    await updateUserNotificationPreferences(userId, data)

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
    })
  } catch (error) {
    console.error('API: /api/notifications/preferences - Error occurred:', error)
    const detail =
      error instanceof Error ? error.message : 'Failed to update notification preferences. Please try again later.'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
