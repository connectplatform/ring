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
 * GET /api/account/restore-request — current open restore procedure for suspended user
 */
export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { status } = await getLiveAccountStatus(session.user.id)
  if (status !== 'SUSPENDED') {
    return NextResponse.json({ error: 'Account is not suspended' }, { status: 400 })
  }

  const procedure = await getAccountRestoreProcedureForSession(session.user.id)
  return NextResponse.json({ success: true, procedure })
}

/**
 * POST /api/account/restore-request
 */
export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { status: accountStatus } = await getLiveAccountStatus(session.user.id)
  if (accountStatus !== 'SUSPENDED') {
    return NextResponse.json({ error: 'Account is not suspended' }, { status: 400 })
  }

  let body
  try {
    body = accountRestoreRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await submitAccountRestoreRequest(session.user.id, body)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('POST /api/account/restore-request:', error)
    return NextResponse.json({ error: 'Failed to submit restore request' }, { status: 500 })
  }
}
