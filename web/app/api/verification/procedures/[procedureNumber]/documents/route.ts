import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  attachVerificationDocuments,
  submitVerificationProcedure,
} from '@/features/verification/services/attach-verification-documents'
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure'
import { toClientView } from '@/features/verification/lib/procedure-mapper'
import { getVerificationProcedureByNumber } from '@/features/verification/services/get-verification-procedure'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

const documentSchema = z.object({
  documentType: z.string().min(1),
  objectKey: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  autoSubmit: z.boolean().optional(),
})

/**
 * POST /api/verification/procedures/{procedureNumber}/documents
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ procedureNumber: string }>,
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { procedureNumber } = await context.params
  if (!procedureNumber) {
    return NextResponse.json({ error: 'Invalid procedure number' }, { status: 400 })
  }

  try {
    const body = documentSchema.parse(await req.json())
    await attachVerificationDocuments({
      procedureNumber,
      applicantUserId: session.user.id,
      documentType: body.documentType,
      objectKey: body.objectKey,
      fileName: body.fileName,
      contentType: body.contentType,
    })

    if (body.autoSubmit) {
      const current = await getVerificationProcedureByNumber(procedureNumber)
      if (current?.status === 'draft') {
        await submitVerificationProcedure(procedureNumber, session.user.id)
      }
    }

    const procedure = await getVerificationProcedureByNumber(procedureNumber)
    return NextResponse.json({
      success: true,
      procedure: procedure ? toClientView(procedure) : null,
    })
  } catch (error) {
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
