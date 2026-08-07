import { NextRequest, NextResponse, connection } from 'next/server'
import {
  inviteEntityMember,
  EntityInviteError,
} from '@/features/entities/services/invite-entity-member'
import { EntityOwnershipError } from '@/features/entities/lib/assert-entity-owner'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

// Zod schema for request body validation to enforce email requirement and (optional) role.
const bodySchema = z.object({
  email: z.string().email(), // strict, guarantees valid email received (required)
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(), // Acceptable member roles
})

/**
 * POST /api/entities/{id}/invite 
 * Handles invitation of an existing user (identified by email) to join an entity as a member.
 * Performs:
 *  1. DB connection readiness.
 *  2. Route param validation, including entity ID presence.
 *  3. Input body validation.
 *  4. Business operation & error handling.
 *
 * @param req - NextRequest containing body with invite details
 * @param context - Route handler context with URL params.
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  // Wait for an active database connection (safe for lambda colocation/edge, add error catch if needed)
  await connection()

  // Extract the `id` param from the route, required for targeting an entity
  const { id } = await context.params
  if (!id) {
    // Defensive: fail early if no entity ID -- cannot proceed without entity target
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    // Validate and parse body using zod; this catches both invalid JSON and schema errors
    body = bodySchema.parse(await req.json())
  } catch {
    // Users must provide a valid JSON body with a properly formatted email address
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  try {
    // Main business logic: delegates invite handling; may throw coded errors for domain-specific issues
    const result = await inviteEntityMember(id, body)
    // Success: respond with result and HTTP 200
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    // Specific error: entity ownership or authentication issues
    if (error instanceof EntityOwnershipError) {
      // Currently does string check for "Authentication" to distinguish need for login vs no permission
      // TODO: Use error.code instead of error.message for security and clarity
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    // Specific error: invitee already invited or other invite conflicts
    if (error instanceof EntityInviteError) {
      // Distinguish "already invited" from generic invite errors via string parsing
      // TODO: Prefer structured error codes instead of error.message text inspection
      const status = error.message.includes('already') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    // Catch-all: unexpected errors that should be logged, but not leaked in detail to client
    // TODO: With Next.js 16, use built-in API error boundaries or middleware-based logging/reporting
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// TODO: When adopting Next.js 16 and React 19:
// - Move authentication/authorization checks to API middleware for DRY and type safety.
// - Use Next.js API route error boundaries for structured error propagation/logging, instead of generic error handling here.
// - Consider adopting new per-request context patterns for more ergonomic tracing/logging across handlers.