import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { readJsonBody } from '@/lib/server/request'
import { createAdminPublicPool, listPublicPools } from '@/features/public-pools/services/public-pool-service'
import { PublicPoolAdminCreateSchema } from '@/lib/zod/public-pool-schemas'

// Handler for GET requests to list public pools
export async function GET() {
  // Establish database connection
  await connection()

  // Get the current user session
  const session = await auth()
  // Check if the user is authenticated and a platform admin
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch list of public pools, limiting to 200 results
  // TODO: Use cursor-based pagination to support more than 200 pools efficiently in the future.
  const pools = await listPublicPools({ limit: 200 })

  // Return the list of public pools
  return NextResponse.json({ pools })
}

// Handler for POST requests to create a new public pool
export async function POST(request: NextRequest) {
  // Establish database connection
  await connection()

  // Get the current user session
  const session = await auth()
  // Check if the user is authenticated and a platform admin
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse and validate the request body using Zod schema
  const body = await readJsonBody(request)
  const parsed = PublicPoolAdminCreateSchema.safeParse(body)
  if (!parsed.success) {
    // Return validation error details
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    // Attempt to create a new public pool with valid data
    const pool = await createAdminPublicPool(parsed.data)
    // Return the created pool with 201 Created status
    return NextResponse.json({ pool }, { status: 201 })
  } catch (error) {
    // Handle and return any errors that occur during pool creation
    const message = error instanceof Error ? error.message : 'Failed to create pool'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
