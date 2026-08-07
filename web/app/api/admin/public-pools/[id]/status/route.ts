import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import { PublicPoolStatusUpdateSchema } from '@/lib/zod/public-pool-schemas'
import { updatePoolStatus } from '@/features/public-pools/services/public-pool-service'

// Handler for POST requests to update the status of a public pool
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // Establish DB connection for request lifecycle
  await connection()

  // Get the authenticated session
  const session = await auth()

  // Ensure user is logged in AND is a platform admin
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    // If not, deny with 403
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // TODO: Next.js 16 allows simpler param extraction: context.params can likely be awaited at the route level, not inside the handler.
  // Extract `id` parameter from route
  const { id } = await context.params

  // Parse and validate incoming JSON body
  const body = await readJsonBody(request)
  const parsed = PublicPoolStatusUpdateSchema.safeParse(body)

  // If validation fails, return error with validation details
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    // Attempt to update pool status with provided data
    const pool = await updatePoolStatus(id, parsed.data.status)
    // On success, return updated pool data
    return NextResponse.json({ pool })
  } catch (error) {
    // On error, return descriptive error message
    const message = error instanceof Error ? error.message : 'Failed to update pool status'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
