import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

export const GET = withMcpGuard(async () => {
  return mcpOk({
    status: 'ok',
    service: 'ring-mcp-gateway',
    version: 'v1',
    timestamp: new Date().toISOString(),
  })
})
