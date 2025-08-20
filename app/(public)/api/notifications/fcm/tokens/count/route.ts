import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'

const db = getAdminDb()

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const tokensCollection = db.collection('fcm_tokens')

    // Get count of active tokens for the user
    const tokensSnapshot = await tokensCollection
      .where('userId', '==', session.user.id)
      .where('isActive', '==', true)
      .get()

    const count = tokensSnapshot.size

    // Get device breakdown
    const devices = tokensSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        platform: data.deviceInfo?.platform || 'Unknown',
        browser: data.deviceInfo?.browser || 'Unknown',
        lastSeen: data.deviceInfo?.lastSeen?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
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