import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getMyVerificationProcedureView } from '@/features/verification/services/get-verification-queue'
import { EntityPermissionError } from '@/lib/errors'

/**
 * GET /api/verification/procedures/me?subjectType=user_kyc
 * POST — bootstrap draft user_kyc procedure for current user
 */
export async function GET(request: NextRequest) {
  await connection()

  const subjectType = request.nextUrl.searchParams.get('subjectType') || 'user_kyc'

  try {
    const procedure = await getMyVerificationProcedureView(subjectType)
    return NextResponse.json({ success: true, procedure })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subjectType = request.nextUrl.searchParams.get('subjectType') || 'user_kyc'

  try {
    const { getOrCreateOpenVerificationProcedure } = await import(
      '@/features/verification/services/create-verification-procedure'
    )
    const { toClientView } = await import('@/features/verification/lib/procedure-mapper')

    const procedure = await getOrCreateOpenVerificationProcedure({
      subjectType: subjectType as 'user_kyc',
      subjectId: session.user.id,
      applicantUserId: session.user.id,
    })

    return NextResponse.json({ success: true, procedure: toClientView(procedure) })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
