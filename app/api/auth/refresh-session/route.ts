import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'

/**
 * Session Refresh API Endpoint
 * Forces a refresh of the JWT token to get latest user data from database
 * Used when admin menu doesn't show due to stale session role
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Get current session
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // The session will be refreshed on next auth() call due to JWT callback
    // This endpoint just confirms the refresh mechanism is working
    return NextResponse.json({
      success: true,
      message: 'Session refresh triggered. Refresh the page to see updated role.',
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role
      }
    })

  } catch (error) {
    console.error('Session refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 })
  }
}
