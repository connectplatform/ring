import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import {
  deleteAdminPublicPool,
  getPublicPoolById,
  updateAdminPublicPool,
} from '@/features/public-pools/services/public-pool-service'
import { PublicPoolAdminUpdateSchema } from '@/lib/zod/public-pool-schemas'

// Handles GET request for a specific public pool by id
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection() // Ensure DB connection (could be a noop with Next 16 middleware layer, review and refactor as needed)
  
  const session = await auth() // Authenticate user
  // Check for authorized admin user; forbid if not
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // TODO: Consider using Next.js Route Handlers context.params synchronously with recent changes if possible
  const { id } = await context.params
  const pool = await getPublicPoolById(id) // Fetch pool by id
  
  // Return 404 if pool is not found
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  // Successful response with found pool data
  return NextResponse.json({ pool })
}

// Handles PATCH request to update specific public pool by id
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection() // Ensure DB connection

  const session = await auth() // Authenticate user
  // Check for authorized admin user
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // TODO: Analogous to GET - check if newer Next allows synchronous/context param for simpler code

  const { id } = await context.params
  const pool = await getPublicPoolById(id) // Check that pool exists
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  // Parse and validate request body against schema
  const body = await readJsonBody(request)
  const parsed = PublicPoolAdminUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    // Attempt to update the pool
    const updated = await updateAdminPublicPool(id, parsed.data)
    return NextResponse.json({ pool: updated })
  } catch (error) {
    // Proper error reporting with fallback
    const message = error instanceof Error ? error.message : 'Failed to update pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// Handles DELETE request to remove a public pool by id
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection() // Ensure DB connection

  const session = await auth() // Authenticate user
  // Check if user is authorized as platform admin
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // TODO: If Next middleware/context allows, refactor to remove await on params

  const { id } = await context.params
  const pool = await getPublicPoolById(id) // Verify pool exists
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  try {
    // Attempt deletion of the pool
    await deleteAdminPublicPool(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    // Propagate error with explanatory message
    const message = error instanceof Error ? error.message : 'Failed to delete pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
