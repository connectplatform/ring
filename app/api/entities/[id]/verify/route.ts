import { NextRequest, NextResponse, connection } from 'next/server'
import {
  requestEntityVerification,
  EntityVerificationError,
} from '@/features/entities/services/request-entity-verification'
import { EntityOwnershipError } from '@/features/entities/lib/assert-entity-owner'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

// Define the request body schema using Zod for input validation
const bodySchema = z.object({
  note: z.string().max(2000).optional(),
})

/**
 * POST /api/entities/{id}/verify
 * - Queues an entity for platform verification review.
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  // Ensure database (or service) connection is established before request handling
  await connection()
  // TODO: Use Next.js Middleware (App Middleware, Route Handlers middleware) for connection management in Next 16.

  const { id } = await context.params
  // Guard clause for missing or invalid entity ID in URL params
  if (!id) {
    // Respond with 400 Bad Request for missing or malformed entity ID
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let note: string | undefined = undefined
  try {
    // Attempt to parse and validate incoming request body using Zod
    // If parsing fails or field is missing, this will throw (caught below)
    const body = await req.json()
    note = bodySchema.parse(body).note
  } catch {
    // If JSON parse or validation fails, ignore and proceed (note is optional)
    // TODO: Consider logging or reporting malformed requests for analytics or debugging (if desired)
  }

  try {
    // Call service/business method to request verification of the entity
    // This handles queuing and verification business logic outside the route
    const result = await requestEntityVerification(id, note)
    // On success: respond with 202 Accepted to indicate queuing was successful
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    // Handle domain-specific errors and map to HTTP response codes

    if (error instanceof EntityOwnershipError) {
      // Distinguish between authn and authz errors
      // If error mentions Authentication, respond with 401 Unauthorized, otherwise 403 Forbidden
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }

    if (error instanceof EntityVerificationError) {
      // If verification has already been requested, respond with 409 Conflict
      // Otherwise treat as 400 Bad Request (e.g. invalid state)
      const status = error.message.includes('already') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }

    if (error instanceof Error && error.message.includes('not found')) {
      // Handle entity-not-found cases with 404 Not Found
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // For any other/unexpected errors, return 500 Internal Server Error
    // This catch-all is important to avoid leaking stack traces or sensitive details
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// TODO: In React 19/Next 16 you could use Server Actions for mutation endpoints like this one.
// TODO: Consider using NextResponse.create for streaming (chunked) API responses if reviewing large payloads in the future.
// TODO: If entity ID param validation becomes more complex, consider using Zod for params as well.