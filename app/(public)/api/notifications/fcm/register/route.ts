import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { Timestamp } from 'firebase-admin/firestore'

const db = getAdminDb()

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { token, deviceInfo } = await req.json()

    if (!token) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      )
    }

    if (!deviceInfo) {
      return NextResponse.json(
        { error: 'Device info is required' },
        { status: 400 }
      )
    }

    const tokensCollection = db.collection('fcm_tokens')

    // Check if token already exists
    const existingToken = await tokensCollection
      .where('token', '==', token)
      .limit(1)
      .get()

    if (!existingToken.empty) {
      // Update existing token
      const doc = existingToken.docs[0]
      await doc.ref.update({
        userId: session.user.id,
        deviceInfo: {
          ...deviceInfo,
          lastSeen: Timestamp.fromDate(new Date(deviceInfo.lastSeen))
        },
        isActive: true,
        updatedAt: Timestamp.now()
      })

      console.log(`FCM token updated for user ${session.user.id}`)
    } else {
      // Create new token
      await tokensCollection.add({
        userId: session.user.id,
        token,
        deviceInfo: {
          ...deviceInfo,
          lastSeen: Timestamp.fromDate(new Date(deviceInfo.lastSeen))
        },
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })

      console.log(`FCM token registered for user ${session.user.id}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error registering FCM token:', error)
    return NextResponse.json(
      { error: 'Failed to register FCM token' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        { error: 'FCM token is required' },
        { status: 400 }
      )
    }

    const tokensCollection = db.collection('fcm_tokens')

    // Find and deactivate token
    const tokenSnapshot = await tokensCollection
      .where('token', '==', token)
      .where('userId', '==', session.user.id)
      .limit(1)
      .get()

    if (!tokenSnapshot.empty) {
      await tokenSnapshot.docs[0].ref.update({
        isActive: false,
        updatedAt: Timestamp.now()
      })

      console.log(`FCM token removed for user ${session.user.id}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing FCM token:', error)
    return NextResponse.json(
      { error: 'Failed to remove FCM token' },
      { status: 500 }
    )
  }
} 