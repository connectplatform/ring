import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

// Exports a GET handler with MCP guard for authorization
export const GET = withMcpGuard(async (_request, actor) => {
  // Determine the base URL for the platform, prioritizing in order of environment variables
  // Falls back to localhost if none are set
  // TODO: Consider moving this logic to a utility/helper for reuse and easier testing.
  const baseUrl =
    process.env.RING_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'

  // Return MCP-formatted JSON object with platform and actor context
  // TODO: Make the `cloneName` detection more robust if additional naming environments are introduced.
  return mcpOk({
    cloneName: process.env.RING_CLONE_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'ring-platform',
    baseUrl,
    role: actor.role, // Role as detected by auth guard
    actor: {
      id: actor.id,     // User's unique identifier
      email: actor.email, // User's email address
      name: actor.name,   // User's display name
    },
    gateway: '/api/mcp/v1', // API base path, consider moving to a constant if reused elsewhere.
  })
})
