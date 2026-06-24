import { NextRequest, NextResponse, connection } from 'next/server'
import {
  updateAdminUserAccountStatus,
} from '@/app/_actions/admin-account-status'
import { z } from 'zod'

// Move all types, schema, and helpers to non-exported, or inline types
const adminAccountStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().max(2000).optional(),
  fraudScore: z.number().min(0).max(100).optional(),
})

type AdminAccountStatusBody = z.infer<typeof adminAccountStatusBodySchema>
/**
 * PUT /api/admin/users/[id]/status
 *
 * Conventional HTTP entry for admin GUI (fraud desk, scripts, MCP).
 * Delegates to shared admin-account-status orchestration (suspend + tunnel notify).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  const { id: userId } = await params

  let body
  try {
    body = adminAccountStatusBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const result = await updateAdminUserAccountStatus(userId, body)

    if (result.success === false) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode })
    }

    if (result.status === 'SUSPENDED') {
      return NextResponse.json({
        success: true,
        status: 'SUSPENDED',
        sessionsRevoked: result.sessionsRevoked,
      })
    }

    return NextResponse.json({ success: true, status: 'ACTIVE' })
  } catch (error) {
    console.error('PUT /api/admin/users/[id]/status:', error)
    return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 })
  }
}
