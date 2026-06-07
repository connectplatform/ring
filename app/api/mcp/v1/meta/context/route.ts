import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

export const GET = withMcpGuard(async (_request, actor) => {
  const baseUrl =
    process.env.RING_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'

  return mcpOk({
    cloneName: process.env.RING_CLONE_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'ring-platform',
    baseUrl,
    role: actor.role,
    actor: {
      id: actor.id,
      email: actor.email,
      name: actor.name,
    },
    gateway: '/api/mcp/v1',
  })
})
