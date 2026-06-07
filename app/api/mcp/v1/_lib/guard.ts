import type { NextRequest } from 'next/server'
import { verifyServiceToken } from '@/lib/auth/service-token'
import { runWithMcpActor, type McpActor } from '@/lib/auth/mcp-actor-context'
import { mcpError } from '@/app/api/mcp/v1/_lib/respond'

type RouteContext = { params: Promise<Record<string, string>> }

export type McpRouteHandler = (
  request: NextRequest,
  actor: McpActor,
  context?: RouteContext
) => Promise<Response>

export function withMcpGuard(handler: McpRouteHandler) {
  return async (request: NextRequest, context?: RouteContext) => {
    const verified = verifyServiceToken(request)
    if (verified.ok === false) {
      return mcpError(verified.error, 401)
    }

    try {
      return await runWithMcpActor(verified.actor, () => handler(request, verified.actor, context))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return mcpError(message, 500)
    }
  }
}
