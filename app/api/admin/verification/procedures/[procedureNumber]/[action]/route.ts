import { NextRequest, NextResponse, connection } from 'next/server'
import {
  approveVerificationProcedure,
  rejectVerificationProcedure,
  requestVerificationInfo,
  markVerificationUnderReview,
} from '@/features/verification/services/kyc-validator'
import { VerificationProcedureError } from '@/features/verification/services/create-verification-procedure'
import { EntityPermissionError } from '@/lib/errors'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

const bodySchema = z.object({
  note: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
})

async function handleAction(
  procedureNumber: string,
  action: string,
  body: z.infer<typeof bodySchema>,
) {
  switch (action) {
    case 'approve':
      return approveVerificationProcedure(procedureNumber)
    case 'reject':
      return rejectVerificationProcedure(procedureNumber, body.rejectionReason || '')
    case 'request-info':
      return requestVerificationInfo(procedureNumber, body.note || '')
    case 'under-review':
      return markVerificationUnderReview(procedureNumber)
    default:
      return null
  }
}

/**
 * POST /api/admin/verification/procedures/{procedureNumber}/{action}
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ procedureNumber: string; action: string }>,
) {
  await connection()

  const { procedureNumber, action } = await context.params
  if (!procedureNumber || !action) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  let body: z.infer<typeof bodySchema> = {}
  try {
    const raw = await req.json().catch(() => ({}))
    body = bodySchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await handleAction(procedureNumber, action, body)
    if (!result) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof VerificationProcedureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
