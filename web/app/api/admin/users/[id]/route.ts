import { NextRequest, NextResponse, connection } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { isPlatformAdmin } from '@/features/auth/user-role'

// List of sensitive user object keys that should not be exposed in API responses
const SENSITIVE_USER_KEYS = [
  'password',
  'passwordHash',
  'hashedPassword',
  'encryptedPassword',
  'salt',
] as const

/**
 * Remove sensitive user fields from user objects before sending over the wire.
 * @param record - user object possibly containing sensitive fields
 * @returns a shallow clone of the record without sensitive fields
 */
function stripSensitiveUserFields(record: Record<string, unknown>) {
  // Make a shallow copy to avoid mutating the original
  const out = { ...record }
  for (const k of SENSITIVE_USER_KEYS) {
    delete out[k]
  }
  return out
}

/**
 * Checks if the session user exists and is a platform admin.
 * @param session Session or null
 * @returns boolean - whether user can manage users
 */
function canManageUsers(session: Session | null) {
  // Only platform admins are authorized to perform these actions
  return !!session?.user && isPlatformAdmin(session.user.role)
}

/**
 * GET /api/admin/users/[id]
 * Returns a single user document for admin UI with sensitive fields removed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection() // Ensure DB connection is established

  try {
    const session = await auth()
    // Only platform admins may fetch users
    if (!canManageUsers(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Await `params` to extract user id
    const { id } = await params
    // Fetch user record from database by id
    const userResult = await db().readDoc<Record<string, unknown>>('users', id)

    // Handle DB read errors
    if (!userResult.success) {
      // When DB has not been initialized
      if (userResult.metadata?.operation === 'initialize') {
        return NextResponse.json(
          { error: 'Database initialization failed' },
          { status: 500 },
        )
      }
      // Other database errors
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }

    // User not found
    if (!userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove sensitive fields before returning user object
    const data = stripSensitiveUserFields(userResult.data)

    // Success: return the sanitized user object
    return NextResponse.json({ success: true, data })
  } catch (error) {
    // Log unexpected errors for operator insight
    console.error('GET /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 },
    )
  }

  // TODO: Consider memoizing auth/session for multiple admin API actions per request lifecycle in app router for React 19/Next 16.
  // TODO: When React server actions for routes matures, consider replacing REST with direct server action exposure for admin UI.
}

/**
 * DELETE /api/admin/users/[id]
 * Remove a user (admin / superadmin). Used by admin user manager.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection() // Ensure database connection

  try {
    const session = await auth()
    // Authorization check: only platform admins may delete users
    if (!canManageUsers(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Prevent self-deletion by the logged-in admin
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 },
      )
    }

    // Check if the user exists in the database before deletion
    const userResult = await db().readDoc<Record<string, unknown>>('users', id)

    if (!userResult.success) {
      if (userResult.metadata?.operation === 'initialize') {
        return NextResponse.json(
          { error: 'Database initialization failed' },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }

    // User does not exist
    if (!userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove user document from the database
    const del = await db().deleteDoc('users', id)
    if (!del.success) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 },
      )
    }

    // Success: user deleted
    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    // Log details for debugging
    console.error('DELETE /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 },
    )
  }

  // TODO: With React 19/Next 16, consider a single error-handling abstraction for all API route methods to further DRY up error returns.
}
