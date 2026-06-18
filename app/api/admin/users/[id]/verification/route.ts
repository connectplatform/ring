import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { EntityPermissionError } from '@/lib/errors'
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure'
import {
  assertAdminManualVerificationAccess,
  setAdminManualUserVerification,
} from '@/features/verification/services/admin-manual-user-verification'

const bodySchema = z.object({
  isVerified: z.boolean(),
  verifiedAtLocal: z.string().optional(),
  verifiedAtLocalDisplay: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const { id } = await params
    const admin = await assertAdminManualVerificationAccess()
    const body = bodySchema.parse(await request.json())

    const result = await setAdminManualUserVerification({
      targetUserId: id,
      isVerified: body.isVerified,
      adminUserId: admin.adminUserId,
      adminName: admin.adminName,
      adminEmail: admin.adminEmail,
      verifiedAtLocal: body.verifiedAtLocal,
      verifiedAtLocalDisplay: body.verifiedAtLocalDisplay,
    })

    return NextResponse.json({
      success: true,
      message: body.isVerified
        ? 'User verified manually by admin'
        : 'User verification cleared',
      ...result,
    })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    console.error('Error updating user verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
