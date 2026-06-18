import type { NextRequest } from 'next/server'
import { UserRole } from '@/features/auth/types'
import type { McpActor } from '@/lib/auth/mcp-actor-context'

const SERVICE_ACTOR_ID = process.env.RING_MCP_SERVICE_USER_ID || 'ring-mcp-service'
const SERVICE_ACTOR_EMAIL = process.env.RING_MCP_SERVICE_USER_EMAIL || 'ring-mcp@system.local'
const SERVICE_ACTOR_NAME = process.env.RING_MCP_SERVICE_USER_NAME || 'Ring MCP Service'

function getAllowedTokens(): string[] {
  return (process.env.RING_MCP_SERVICE_TOKENS || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

export function buildMcpServiceActor(): McpActor {
  return {
    id: SERVICE_ACTOR_ID,
    email: SERVICE_ACTOR_EMAIL,
    name: SERVICE_ACTOR_NAME,
    role: UserRole.superadmin,
  }
}

export function verifyServiceToken(
  request: NextRequest
): { ok: true; actor: McpActor } | { ok: false; error: string } {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (!token) {
    return { ok: false, error: 'Missing Bearer token' }
  }

  const allowed = getAllowedTokens()
  if (allowed.length === 0) {
    return { ok: false, error: 'RING_MCP_SERVICE_TOKENS is not configured' }
  }

  if (!allowed.includes(token)) {
    return { ok: false, error: 'Invalid service token' }
  }

  return { ok: true, actor: buildMcpServiceActor() }
}
