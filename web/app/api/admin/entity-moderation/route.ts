import { NextResponse } from 'next/server'
import { getEntityModerationQueue } from '@/features/admin/matcher/get-entity-moderation-queue'
import { EntityPermissionError } from '@/lib/errors'

// GET handler for returning the moderation queue
export async function GET() {
  try {
    // Attempt to retrieve the moderation queue
    const queue = await getEntityModerationQueue()
    // Respond with the list of items on success
    return NextResponse.json({ items: queue })
  } catch (error) {
    // Permission errors are handled explicitly and return 403
    if (error instanceof EntityPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    // For all other errors, return a 500 and suitable message
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load moderation queue' },
      { status: 500 },
    )
  }
}

// TODO: Consider using Route Handlers' improved error encapsulation in Next.js 13/14+,
// such as using `Response.json()` directly (instead of NextResponse) for native edge runtime integration.
// TODO: If possible, perform runtime type-checking or validation on the result of getEntityModerationQueue
// to catch any shape issues earlier and provide more precise feedback.
// TODO: If this endpoint might need authentication in the future, integrate with Next.js 16's server actions 
// or middleware for consistent access control around API calls.