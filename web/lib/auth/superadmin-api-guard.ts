import { auth } from '@/auth'
import { UserRolesArray } from '@/features/auth/user-role'
import { NextResponse } from 'next/server'

// Type to represent a non-nullable session object returned from `auth()`
// Ensures all logic below only deals with valid session shapes
type SuperadminSession = NonNullable<Awaited<ReturnType<typeof auth>>>

// Result type for requiring a superadmin; either a successful session extraction
// or a failure response to be sent to the requesting client
type SuperadminGuardResult =
  | { ok: true; session: SuperadminSession }
  | { ok: false; response: NextResponse }

/**
 * Authenticates if the current user is a superadmin.
 * Returns an object with either the validated session or a NextResponse error.
 * Designed for securing API routes to allow only superadmins.
 * 
 * TODO: Consider switching to Next.js middleware pattern with Route Handlers 
 * for API route protection when on Next.js 13+ (native support with app router).
 */
export async function requireSuperadminApi(): Promise<SuperadminGuardResult> {
  // Retrieve the current session asynchronously from the authentication provider
  const session = await auth()

  // If there is no session or session lacks user object, user is not authenticated
  if (!session?.user) {
    // Return a 401 Unauthorized response (standard practice)
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // If the authenticated user's role is not superadmin, mark as forbidden
  // NOTE: This comparison assumes UserRolesArray.superadmin holds the intended superadmin value
  if (session.user.role !== UserRolesArray.superadmin) {
    // Return a 403 Forbidden response for insufficient privilege
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // All checks passed; return session with ok status
  return { ok: true, session }
}
