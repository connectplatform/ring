import { NextRequest, NextResponse, connection } from 'next/server'
import {
  updateAdminUserAccountStatus,
} from '@/app/_actions/admin-account-status'
import { z } from 'zod'

// Schema for validating incoming body payload for status update
const adminAccountStatusBodySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']), // Only allow specific statuses
  reason: z.string().max(2000).optional(), // Optional reason field, with length constraint
  fraudScore: z.number().min(0).max(100).optional(), // Optional fraudScore, range 0-100
})

type AdminAccountStatusBody = z.infer<typeof adminAccountStatusBodySchema>

/**
 * PUT /api/admin/users/[id]/status
 *
 * - HTTP handler for admin GUI (fraud desk, scripts, MCP).
 * - Delegates to business logic in updateAdminUserAccountStatus.
 * - Expects an ID param and a body conforming to adminAccountStatusBodySchema.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Ensure DB connection for operation
  await connection()

  // Await route parameter for user ID (dynamic route param)
  const { id: userId } = await params

  let body
  try {
    // Attempt to parse and validate request JSON body
    body = adminAccountStatusBodySchema.parse(await request.json())
  } catch {
    // If body doesn't match schema, return 400 with error message
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    // Call dedicated business logic to update user status
    const result = await updateAdminUserAccountStatus(userId, body)

    if (result.success === false) {
      // Delegate error messaging and status code from orchestration layer
      return NextResponse.json({ error: result.error }, { status: result.statusCode })
    }

    if (result.status === 'SUSPENDED') {
      // Explicit branch for SUSPENDED status: surface sessionsRevoked flag for admin context
      return NextResponse.json({
        success: true,
        status: 'SUSPENDED',
        sessionsRevoked: result.sessionsRevoked,
      })
    }

    // For ACTIVE or DEACTIVATED (if not handled elsewhere), respond with plain success
    return NextResponse.json({ success: true, status: 'ACTIVE' })
  } catch (error) {
    // Catch-all for any runtime or orchestration errors
    console.error('PUT /api/admin/users/[id]/status:', error)
    return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 })
  }

  // TODO: If using Next.js 13+/16 API routes, consider extracting params from the new Route Handler signature for clarity/readability, instead of Promise<{ id: string }>.
  // TODO: Consider limiting log exposure in production environments to avoid leaking sensitive info.
  // TODO: SUSPENDED/ACTIVE handling is hardcoded; if future statuses are supported, migrate to explicit enum or dynamic handler.
  // TODO: Review body validation for early return with richer error details (e.g., zod formatted errors in dev mode).
}
