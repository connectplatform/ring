import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { EntityPermissionError } from '@/lib/errors'
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure'
import {
  assertAdminManualVerificationAccess,
  setAdminManualUserVerification,
} from '@/features/verification/services/admin-manual-user-verification'

// Schema validation using zod. Requires 'isVerified' boolean and optional localized dates.
const bodySchema = z.object({
  isVerified: z.boolean(),
  verifiedAtLocal: z.string().optional(),
  verifiedAtLocalDisplay: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Ensure database connection is established before performing logic.
  await connection()

  try {
    // Extract the user id from the request params. This is asynchronous.
    // TODO: Consider updating this logic with the latest Next.js Route Handler `params` typings/behavior in Next 13/14/16 for improved DX.
    const { id } = await params

    // Verify the requesting user has admin privileges for manual verification.
    const admin = await assertAdminManualVerificationAccess()

    // Parse and validate the request body using the schema.
    const body = bodySchema.parse(await request.json())

    // Perform the core action: set or clear the verification status for the user.
    // Passes through necessary admin meta for auditing.
    const result = await setAdminManualUserVerification({
      targetUserId: id,
      isVerified: body.isVerified,
      adminUserId: admin.adminUserId,
      adminName: admin.adminName,
      adminEmail: admin.adminEmail,
      verifiedAtLocal: body.verifiedAtLocal,
      verifiedAtLocalDisplay: body.verifiedAtLocalDisplay,
    })

    // Respond with success and a message tailored to the verification action.
    return NextResponse.json({
      success: true,
      message: body.isVerified
        ? 'User verified manually by admin'
        : 'User verification cleared',
      ...result,
    })
  } catch (error) {
    // Handle permissions errors. Returns 401 if it's authentication, 403 for other permission issues.
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    // Handle domain/service-specific procedure errors.
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Handle request validation errors from zod.
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    // TODO: Use Next 13+/16 error handling patterns such as `error.ts` or improved error boundary for APIs (when available).
    console.error('Error updating user verification:', error)
    // Catch-all for unexpected errors.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
