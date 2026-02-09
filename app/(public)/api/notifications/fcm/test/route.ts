import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { getMessaging } from 'firebase-admin/messaging'
import { getAdminDb } from '@/lib/firebase-admin.server'

const db = getAdminDb()

export async function POST(req: NextRequest) {
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

    const { message: customMessage } = await req.json().catch(() => ({}))

    // Get user's FCM tokens
    const tokensSnapshot = await db
      .collection('fcm_tokens')
      .where('userId', '==', session.user.id)
      .where('isActive', '==', true)
      .get()

    if (tokensSnapshot.empty) {
      return NextResponse.json({
        success: false,
        error: 'No active FCM tokens found for user',
        tokenCount: 0
      })
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token)
    const messaging = getMessaging()

    // Prepare test notification
    const notification = {
      title: 'Ring FCM Test',
      body: customMessage || `Hello ${session.user.name || 'User'}! FCM is working correctly. 🎉`,
      icon: '/icons/notification-icon.png'
    }

    const message = {
      notification,
      data: {
        type: 'test',
        timestamp: Date.now().toString(),
        userId: session.user.id,
        clickAction: '/notifications'
      },
      webpush: {
        notification: {
          ...notification,
          badge: '/icons/badge-icon.png',
          requireInteraction: false,
          click_action: '/notifications',
          tag: 'fcm-test'
        },
        fcm_options: {
          link: '/notifications'
        }
      },
      tokens
    }

    // Send test notification
    const response = await messaging.sendEachForMulticast(message)
    
    console.log(`FCM test notification sent: ${response.successCount}/${tokens.length} successful`)

    // Handle failed tokens
    const failedTokens: string[] = []
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        console.error(`Failed to send to token ${index}:`, resp.error)
        failedTokens.push(tokens[index])
      }
    })

    // Clean up failed tokens
    if (failedTokens.length > 0) {
      const batch = db.batch()
      
      for (const token of failedTokens) {
        const tokenSnapshot = await db
          .collection('fcm_tokens')
          .where('token', '==', token)
          .limit(1)
          .get()
        
        if (!tokenSnapshot.empty) {
          batch.update(tokenSnapshot.docs[0].ref, { 
            isActive: false,
            updatedAt: new Date()
          })
        }
      }

      await batch.commit()
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      stats: {
        totalTokens: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
        failedTokensRemoved: failedTokens.length
      },
      notification,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error sending FCM test notification:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to send test notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
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

    // Get FCM configuration status
    const tokensSnapshot = await db
      .collection('fcm_tokens')
      .where('userId', '==', session.user.id)
      .where('isActive', '==', true)
      .get()

    const tokens = tokensSnapshot.docs.map(doc => ({
      id: doc.id,
      platform: doc.data().deviceInfo?.platform || 'Unknown',
      browser: doc.data().deviceInfo?.browser || 'Unknown',
      lastSeen: doc.data().deviceInfo?.lastSeen?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    }))

    return NextResponse.json({
      fcmConfigured: true,
      tokenCount: tokens.length,
      tokens,
      environment: {
        hasVapidKey: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        hasProjectId: !!process.env.AUTH_FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.AUTH_FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.AUTH_FIREBASE_PRIVATE_KEY
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting FCM test status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get FCM status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 