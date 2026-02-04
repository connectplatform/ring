import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

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

    await initializeDatabase()
    const db = getDatabaseService()

    // Check if token already exists
    const existingTokensResult = await db.query({
      collection: 'fcm_tokens',
      filters: [{ field: 'token', operator: '==', value: token }]
    })
    
    if (!existingTokensResult.success) {
      throw existingTokensResult.error || new Error('Failed to check existing tokens')
    }

    if (existingTokensResult.data.length > 0) {
      // Update existing token
      const existingToken = existingTokensResult.data[0]
      
      const updateResult = await db.update('fcm_tokens', existingToken.id, {
        userId: session.user.id,
        deviceInfo: {
          ...deviceInfo,
          lastSeen: new Date(deviceInfo.lastSeen)
        },
        isActive: true,
        updatedAt: new Date()
      })
      
      if (!updateResult.success) {
        throw updateResult.error || new Error('Failed to update FCM token')
      }

      console.log(`FCM token updated for user ${session.user.id}`)
    } else {
      // Create new token
      const createResult = await db.create('fcm_tokens', {
        userId: session.user.id,
        token,
        deviceInfo: {
          ...deviceInfo,
          lastSeen: new Date(deviceInfo.lastSeen)
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      if (!createResult.success) {
        throw createResult.error || new Error('Failed to create FCM token')
      }

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

    await initializeDatabase()
    const db = getDatabaseService()

    // Find and deactivate token
    const tokenResult = await db.query({
      collection: 'fcm_tokens',
      filters: [
        { field: 'token', operator: '==', value: token },
        { field: 'userId', operator: '==', value: session.user.id }
      ]
    })
    
    if (!tokenResult.success) {
      throw tokenResult.error || new Error('Failed to find FCM token')
    }

    if (tokenResult.data.length > 0) {
      const foundToken = tokenResult.data[0]
      
      const updateResult = await db.update('fcm_tokens', foundToken.id, {
        isActive: false,
        updatedAt: new Date()
      })
      
      if (!updateResult.success) {
        throw updateResult.error || new Error('Failed to deactivate FCM token')
      }

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
