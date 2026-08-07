import type { NextRequest } from 'next/server'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import type { McpActor } from '@/lib/auth/mcp-actor-context'

// Fetch service actor properties from environment variables or fallback to defaults
// TODO: Consider using Next.js 16's built-in env validation or config system, e.g. `process.env.NEXT_PUBLIC_*` for strict type-safety
const SERVICE_ACTOR_ID =
  process.env.RING_MCP_SERVICE_USER_ID || 'ring-mcp-service'
const SERVICE_ACTOR_EMAIL =
  process.env.RING_MCP_SERVICE_USER_EMAIL || 'ring-mcp@system.local'
const SERVICE_ACTOR_NAME =
  process.env.RING_MCP_SERVICE_USER_NAME || 'Ring MCP Service'

/**
 * Retrieve allowed service tokens as an array.
 * Reads the `RING_MCP_ACCESS_KEY` env variable, splits by comma,
 * trims each token and removes empty entries.
 *
 * @returns {string[]} Array of allowed tokens
 */
function getAllowedTokens(): string[] {
  // TODO: In Next16, consider loading environment variables at build time for better caching/runtime perf
  return (process.env.RING_MCP_ACCESS_KEY || '')
    .split(',') // Separate tokens by comma
    .map((token) => token.trim()) // Remove leading/trailing whitespace
    .filter(Boolean) // Exclude empty strings
}

/**
 * Build a McpActor representing the service user (superadmin).
 * Uses env or fallback values for actor properties.
 *
 * @returns {McpActor} The service user actor object
 */
export function buildMcpServiceActor(): McpActor {
  // TODO: Handle dynamic env loading using Next.js server actions/hooks if actor props can be mutated per request
  return {
    id: SERVICE_ACTOR_ID,
    email: SERVICE_ACTOR_EMAIL,
    name: SERVICE_ACTOR_NAME,
    // Asserts and casts the role to superadmin.
    // TODO: Consider enforcing type more strictly with Zod or Next.js config
    role: assertKnownUserRole(UserRolesArray.superadmin) as UserRolesArray,
  }
}

/**
 * Verifies that the request carries a valid Bearer token matching any allowed service token.
 *
 * @param {NextRequest} request The incoming Next.js request (Edge or API)
 * @returns Result object containing service actor if valid, or error string if invalid
 */
export function verifyServiceToken(
  request: NextRequest
): { ok: true; actor: McpActor } | { ok: false; error: string } {
  // Get auth header from Next.js request
  const authHeader = request.headers.get('authorization')
  // Extract Bearer token if header is present and correctly formatted
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  // Reject missing or malformed Bearer token
  if (!token) {
    return { ok: false, error: 'Missing Bearer token' }
  }

  const allowed = getAllowedTokens()

  // Fail fast if allowed tokens are not configured in the environment
  if (allowed.length === 0) {
    return { ok: false, error: 'RING_MCP_ACCESS_KEY is not configured' }
  }

  // Reject invalid token
  if (!allowed.includes(token)) {
    return { ok: false, error: 'Invalid service token' }
  }

  // Return successful result with service actor
  return { ok: true, actor: buildMcpServiceActor() }
}
