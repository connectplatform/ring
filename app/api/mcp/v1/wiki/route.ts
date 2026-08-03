import type { NextRequest } from 'next/server'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import type { McpActor } from '@/lib/auth/mcp-actor-context'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import { isVaultKey } from '@/features/wiki/vault-key'
import * as WikiService from '@/features/wiki/wiki-service'
import type { CreateWikiPageInput } from '@/features/wiki/types'

async function agentActor(mcp: McpActor, orderId?: string) {
  return resolveWikiActor({
    userId: mcp.id,
    role: mcp.role,
    isAgent: true,
    orderId,
  })
}

export const GET = withMcpGuard(async (request: NextRequest, mcpActor: McpActor) => {
  const vaultKey = queryString(request, 'vaultKey') || 'tenant'
  const q = queryString(request, 'q') || queryString(request, 'query')
  const limit = queryInt(request, 'limit', 10)
  if (!isVaultKey(vaultKey)) return mcpError('Invalid vaultKey', 400)

  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  try {
    const actor = await agentActor(mcpActor, orderId)
    await WikiService.ensureTenantSchema(actor)
    if (q) {
      const result = await WikiService.searchPages(actor, q, {
        vaultKey,
        context: queryString(request, 'context') || undefined,
        limit,
      })
      return mcpOk({
        tool: 'ring-wiki-search',
        query: q,
        ...result,
        note: 'Wiki lexical search (legiox-knowledge envelope)',
      })
    }
    const pages = await WikiService.listPages(actor, vaultKey, { limit })
    return mcpOk({ pages })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})

export const POST = withMcpGuard(async (request: NextRequest, mcpActor: McpActor) => {
  try {
    const body = (await readJsonBody(request)) as CreateWikiPageInput
    if (!body?.title || !body?.vaultKey || !isVaultKey(body.vaultKey)) {
      return mcpError('title and vaultKey required', 400)
    }
    const orderId = body.vaultKey.startsWith('po:') ? body.vaultKey.slice(3) : undefined
    const actor = await agentActor(mcpActor, orderId)
    const page = await WikiService.createPage(actor, body)
    return mcpOk({ page }, 201)
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})
