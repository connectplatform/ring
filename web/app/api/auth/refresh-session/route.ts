import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'

/**
 * Session Refresh API Endpoint
 * - Forces a refresh of the JWT token to get latest user data from database.
 * - Used when admin menu doesn't show due to stale session role.
 * - Returns success and current user info if authenticated.
 *
 * TODO: Consider using Next.js 16 middleware for finer-grained authentication control.
 * TODO: Add explicit cache control headers if API response should always be fresh.
 */
export async function POST(request: NextRequest) {
  // Establish DB connection; also disables Next.js route prerendering.
  await connection()

  try {
    // Attempt to retrieve the current auth session (user info via JWT, etc.).
    const session = await auth()

    // If authentication failed or session has no user, respond with 401 Unauthorized.
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Session refresh is handled upstream (in JWT callback), so we just confirm here.
    // Returning user payload to client to confirm refreshed state.
    return NextResponse.json({
      success: true,
      message: 'Session refresh triggered. Refresh the page to see updated role.',
      user: {
        id: session.user.id,    // user's unique id
        email: session.user.email, // user's email address
        role: session.user.role    // user's current role (maybe newly refreshed)
      }
    })
  } catch (error) {
    // Log error for debugging
    console.error('Session refresh error:', error)
    // Respond with generic 500 Internal Server Error for failure
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    )
  }
}
