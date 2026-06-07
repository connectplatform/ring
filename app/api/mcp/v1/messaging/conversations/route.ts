import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  await initializeDatabase()
  const db = getDatabaseService()
  const limit = queryInt(request, 'limit', 50) || 50

  const result = await db.query({
    collection: 'conversations',
    pagination: { limit },
    orderBy: [{ field: 'lastActivity', direction: 'desc' }],
  })

  if (!result.success) return mcpError(result.error?.message || 'Failed to list conversations', 500)

  const rows = (result.data as any[]).map((row) => ({ id: row.id, ...(row.data || row) }))
  const items = rows.filter((conversation) => {
    const participants = conversation.participants || []
    return participants.some((p: any) => p.userId === userId || p.user_id === userId)
  })

  return mcpOk({ items, total: items.length })
})
