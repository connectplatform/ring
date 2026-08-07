import type { NextRequest } from 'next/server'
import { verifyServiceToken } from '@/lib/auth/service-token'
import { runWithMcpActor, type McpActor } from '@/lib/auth/mcp-actor-context'
import { mcpError } from '@/app/api/mcp/v1/_lib/respond'

// RouteContext type expects a promise that resolves to a params object
type RouteContext = { params: Promise<Record<string, string>> }

export type McpRouteHandler = (
  request: NextRequest,
  actor: McpActor,
  context?: RouteContext
) => Promise<Response>

// HOC: Protects API routes by requiring a valid service token and injecting the actor into context.
// TODO: Consider using Next.js middleware (Next16, /middleware.ts) for centralized authentication logic.
export function withMcpGuard(handler: McpRouteHandler) {
  return async (request: NextRequest, context?: RouteContext) => {
    // Verify the request's service token for authentication
    const verified = verifyServiceToken(request)
    if (verified.ok === false) {
      // If token verification fails, respond with error and 401 Unauthorized
      return mcpError(verified.error, 401)
    }

    try {
      // Run handler with verified actor injected into context for authorization
      // TODO: Explore use of React19/Next16 server actions to streamline async actor context propagation.
      return await runWithMcpActor(
        verified.actor,
        () => handler(request, verified.actor, context)
      )
    } catch (error) {
      // Catch and respond with any unhandled exceptions, masking underlying error details
      const message = error instanceof Error ? error.message : String(error)
      return mcpError(message, 500)
    }
  }
}
