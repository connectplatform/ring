import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getLiveAccountStatus } from '@/lib/auth/session-user-status'
import {
  accountRestoreRequestSchema,
  submitAccountRestoreRequest,
  getAccountRestoreProcedureForSession,
} from '@/features/auth/services/account-restore-request'
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure'

/**
 * GET /api/account/restore-request — Returns the current open restore procedure for a suspended user.
 */
export async function GET() {
  // Ensure a DB connection is available before proceeding.
  await connection()

  // Get current user session.
  const session = await auth()
  if (!session?.user?.id) {
    // If no user session or user ID, return 401 Unauthorized.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the live account status for the current user.
  const { status } = await getLiveAccountStatus(session.user.id)
  if (status !== 'SUSPENDED') {
    // If user is not suspended, restore procedure cannot be started.
    return NextResponse.json({ error: 'Account is not suspended' }, { status: 400 })
  }

  // Retrieve any open restore procedure for this user session.
  const procedure = await getAccountRestoreProcedureForSession(session.user.id)
  // Respond with the procedure (possibly null/undefined if none exists).
  return NextResponse.json({ success: true, procedure })
}

/**
 * POST /api/account/restore-request — Submit a new restore request for a suspended account.
 */
export async function POST(request: NextRequest) {
  // TODO: Consider using new Next.js middleware for connection/auth bootstrapping when supported.
  await connection()

  // Get current user session.
  const session = await auth()
  if (!session?.user?.id) {
    // If no user session or user ID, return 401 Unauthorized.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user's account is in suspended status.
  const { status: accountStatus } = await getLiveAccountStatus(session.user.id)
  if (accountStatus !== 'SUSPENDED') {
    // Only suspended users can submit restore requests.
    return NextResponse.json({ error: 'Account is not suspended' }, { status: 400 })
  }

  let body
  try {
    // Parse and validate request body against restore request schema.
    body = accountRestoreRequestSchema.parse(await request.json())
  } catch {
    // If validation fails, return 400 Bad Request.
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    // Attempt to submit the account restore request via service.
    const result = await submitAccountRestoreRequest(session.user.id, body)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    // If an error occurred specific to the verification procedure, return a relevant 400.
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Otherwise, log error (server-side) and return 500 Internal Server Error.
    console.error('POST /api/account/restore-request:', error)
    return NextResponse.json({ error: 'Failed to submit restore request' }, { status: 500 })
  }
  // TODO: Can possibly enhance error handling with Next.js 16 Middleware/Server Actions in the future.
}
