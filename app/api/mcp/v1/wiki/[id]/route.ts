import type { NextRequest } from 'next/server'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import type { McpActor } from '@/lib/auth/mcp-actor-context'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import * as WikiService from '@/features/wiki/wiki-service'
import type { UpdateWikiPageInput } from '@/features/wiki/types'

type RouteContext = { params: Promise<{ id: string }> }

async function agentActor(mcp: McpActor) {
  return resolveWikiActor({
    userId: mcp.id,
    role: mcp.role,
    isAgent: true,
  })
}

export const GET = withMcpGuard(async (_request: NextRequest, mcpActor: McpActor, context?: RouteContext) => {
  const { id } = await context!.params
  try {
    const actor = await agentActor(mcpActor)
    const page = await WikiService.getPage(actor, id)
    if (!page) return mcpError('Not found', 404)
    const backlinks = await WikiService.getBacklinks(actor, id)
    return mcpOk({ page, backlinks })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})

export const PATCH = withMcpGuard(async (request: NextRequest, mcpActor: McpActor, context?: RouteContext) => {
  const { id } = await context!.params
  try {
    const body = (await readJsonBody(request)) as UpdateWikiPageInput
    const actor = await agentActor(mcpActor)
    const page = await WikiService.updatePage(actor, id, body || {})
    return mcpOk({ page })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})

export const DELETE = withMcpGuard(async (request: NextRequest, mcpActor: McpActor, context?: RouteContext) => {
  const { id } = await context!.params
  try {
    const body = (await readJsonBody(request).catch(() => ({}))) as { confirm?: boolean }
    if (!body?.confirm) return mcpError('confirm: true required', 400)
    const actor = await agentActor(mcpActor)
    await WikiService.deletePage(actor, id)
    return mcpOk({ deleted: true })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})
