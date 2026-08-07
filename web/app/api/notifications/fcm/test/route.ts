import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { getMessaging } from 'firebase-admin/messaging'

type FcmTokenRow = Record<string, unknown> & { id: string; token?: string }

async function loadActiveTokens(userId: string): Promise<string[]> {
  const result = await db().queryDocs<FcmTokenRow>({
    collection: 'fcm_tokens',
    filters: [
      { field: 'userId', operator: '==', value: userId },
      { field: 'isActive', operator: '==', value: true },
    ],
  })

  if (!result.success) {
    throw result.error || new Error('Failed to load FCM tokens')
  }

  return result.data
    .map((row) => row.token)
    .filter((token): token is string => typeof token === 'string' && token.length > 0)
}

export async function POST(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { message: customMessage } = await req.json().catch(() => ({}))
    const tokens = await loadActiveTokens(session.user.id)

    if (tokens.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active FCM tokens found for user',
        tokenCount: 0,
      })
    }

    const messaging = getMessaging()
    const notification = {
      title: 'Ring FCM Test',
      body: customMessage || `Hello ${session.user.name || 'User'}! FCM is working correctly.`,
      icon: '/icons/notification-icon.png',
    }

    const message = {
      notification,
      data: {
        type: 'test',
        timestamp: Date.now().toString(),
        userId: session.user.id,
        clickAction: '/notifications',
      },
      webpush: {
        notification: {
          ...notification,
          badge: '/icons/badge-icon.png',
          requireInteraction: false,
          click_action: '/notifications',
          tag: 'fcm-test',
        },
        fcm_options: {
          link: '/notifications',
        },
      },
      tokens,
    }

    const response = await messaging.sendEachForMulticast(message)
    console.log(`FCM test notification sent: ${response.successCount}/${tokens.length} successful`)

    const failedTokens: string[] = []
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        console.error(`Failed to send to token ${index}:`, resp.error)
        failedTokens.push(tokens[index])
      }
    })

    for (const token of failedTokens) {
      const tokenResult = await db().queryDocs<FcmTokenRow>({
        collection: 'fcm_tokens',
        filters: [{ field: 'token', operator: '==', value: token }],
        pagination: { limit: 1 },
      })
      if (tokenResult.success && tokenResult.data.length > 0) {
        await db().updateDoc('fcm_tokens', tokenResult.data[0].id, {
          isActive: false,
          updatedAt: new Date(),
        })
      }
    }

    return NextResponse.json({
      success: response.successCount > 0,
      message:
        response.successCount > 0
          ? 'Test notification sent successfully'
          : 'No tokens accepted the test notification',
      stats: {
        totalTokens: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokensRemoved: failedTokens.length,
      },
      notification,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error sending FCM test notification:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const result = await db().queryDocs<FcmTokenRow>({
      collection: 'fcm_tokens',
      filters: [
        { field: 'userId', operator: '==', value: session.user.id },
        { field: 'isActive', operator: '==', value: true },
      ],
    })

    if (!result.success) {
      throw result.error || new Error('Failed to load FCM tokens')
    }

    const tokens = result.data.map((doc) => {
      const deviceInfo = doc.deviceInfo as Record<string, unknown> | undefined
      return {
        id: doc.id,
        platform: (deviceInfo?.platform as string) || 'Unknown',
        browser: (deviceInfo?.browser as string) || 'Unknown',
        lastSeen: deviceInfo?.lastSeen ?? null,
        createdAt: doc.createdAt ?? null,
      }
    })

    return NextResponse.json({
      fcmConfigured: true,
      tokenCount: tokens.length,
      tokens,
      environment: {
        hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        hasProjectId: !!process.env.AUTH_FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.AUTH_FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.AUTH_FIREBASE_PRIVATE_KEY,
        adminProjectId: process.env.AUTH_FIREBASE_PROJECT_ID,
        clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        projectsAligned:
          process.env.AUTH_FIREBASE_PROJECT_ID === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting FCM test status:', error)
    return NextResponse.json(
      {
        error: 'Failed to get FCM status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
