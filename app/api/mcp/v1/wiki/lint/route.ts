import type { NextRequest } from 'next/server'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryString } from '@/app/api/mcp/v1/_lib/query'
import type { McpActor } from '@/lib/auth/mcp-actor-context'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import { isVaultKey } from '@/features/wiki/vault-key'
import * as WikiService from '@/features/wiki/wiki-service'

export const GET = withMcpGuard(async (request: NextRequest, mcpActor: McpActor) => {
  const vaultKey = queryString(request, 'vaultKey') || 'tenant'
  if (!isVaultKey(vaultKey)) return mcpError('Invalid vaultKey', 400)
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined
  try {
    const actor = await resolveWikiActor({
      userId: mcpActor.id,
      role: mcpActor.role,
      isAgent: true,
      orderId,
    })
    const issues = await WikiService.lintVault(actor, vaultKey)
    return mcpOk({ issues })
  } catch (e) {
    return mcpError(e instanceof Error ? e.message : String(e), 403)
  }
})
