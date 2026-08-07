import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { listAbuseCandidates } from '@/features/fraud/services/fraud-abuse-scoring'

/**
 * Handles GET requests to /api/admin/fraud/candidates endpoint.
 * Returns a list of user accounts that qualify as fraud/abuse candidates
 * based on provided score and limit query parameters.
 */
export async function GET(request: NextRequest) {
  // Establish DB connection before proceeding
  await connection()

  // Authenticate the user session
  const session = await auth()
  // Check that user is logged in and has platform admin role
  if (!session?.user || !isPlatformAdmin(session.user.role)) {
    // Respond with 401 Unauthorized if checks fail
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse query parameters from request URL
  const { searchParams } = new URL(request.url)
  // Clamp limit parameter between 1 and 100 (default: 50)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))
  // minScore must be >= 0 (default: 1)
  const minScore = Math.max(0, Number(searchParams.get('minScore') || 1))

  try {
    // Query for abuse candidates using passed-in parameters
    const candidates = await listAbuseCandidates({ limit, minScore })
    // Respond with success and candidate list payload
    return NextResponse.json({ success: true, candidates })
  } catch (error) {
    // Log error to server for diagnosis
    console.error('GET /api/admin/fraud/candidates:', error)
    // Respond with 500 Internal Error on failure
    return NextResponse.json({ error: 'Failed to load fraud candidates' }, { status: 500 })
  }

  // TODO: Use Next.js 16 Middleware for auth and permissions if available to simplify this handler.
  // TODO: Consider zod or valibot for query param validation with Next.js 16 native request validation support.
}
