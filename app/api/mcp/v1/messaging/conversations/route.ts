import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  const limit = queryInt(request, 'limit', 50) || 50

  const result = await db().queryDocs({
    collection: 'conversations',
    pagination: { limit },
    orderBy: [{ field: 'lastActivity', direction: 'desc' }],
  })

  if (!result.success) return mcpError(result.error?.message || 'Failed to list conversations', 500)

  const rows = result.data ?? []
  const items = rows.filter((conversation) => {
    const participants = Array.isArray(conversation.participants)
      ? (conversation.participants as Array<{ userId?: string; user_id?: string }>)
      : []
    return participants.some((p) => p.userId === userId || p.user_id === userId)
  })

  return mcpOk({ items, total: items.length })
})
