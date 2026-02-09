import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

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

    await initializeDatabase()
    const db = getDatabaseService()

    // Get count of active tokens for the user
    const result = await db.query({
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
    const devices = result.data.map(doc => {
      const data = doc as any
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
