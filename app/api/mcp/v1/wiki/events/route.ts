import type { NextRequest } from 'next/server'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import type { McpActor } from '@/lib/auth/mcp-actor-context'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import { isVaultKey } from '@/features/wiki/vault-key'
import * as WikiService from '@/features/wiki/wiki-service'

export const GET = withMcpGuard(async (request: NextRequest, mcpActor: McpActor) => {
  const vaultKey = queryString(request, 'vaultKey') || 'tenant'
  const limit = queryInt(request, 'limit', 50)
  if (!isVaultKey(vaultKey)) return mcpError('Invalid vaultKey', 400)
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  try {
    const actor = await resolveWikiActor({
      userId: mcpActor.id,
      role: mcpActor.role,
      isAgent: true,
      orderId,
    })
    const events = await WikiService.listEvents(actor, vaultKey, limit)
    return mcpOk({ events })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})

export const POST = withMcpGuard(async (request: NextRequest, mcpActor: McpActor) => {
  try {
    const body = (await readJsonBody(request)) as {
      vaultKey?: string
      action?: string
      summary?: string
      pageId?: string
    }
    if (!body?.vaultKey || !isVaultKey(body.vaultKey) || !body.summary) {
      return mcpError('vaultKey and summary required', 400)
    }
    const orderId = body.vaultKey.startsWith('po:') ? body.vaultKey.slice(3) : undefined
    const actor = await resolveWikiActor({
      userId: mcpActor.id,
      role: mcpActor.role,
      isAgent: true,
      orderId,
    })
    const event = await WikiService.appendEvent({
      actor,
      vaultKey: body.vaultKey,
      action: body.action || 'note',
      summary: body.summary,
      pageId: body.pageId,
    })
    return mcpOk({ event })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})
