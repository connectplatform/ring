import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { getUserPaymentHistory } from '@/features/auth/services/payment-tracking'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (userId) {
    const items = await getUserPaymentHistory(userId)
    return mcpOk({ items, total: items.length })
  }

  await initializeDatabase()
  const db = getDatabaseService()
  const limit = queryInt(request, 'limit', 50) || 50
  const result = await db.query({
    collection: 'payments',
    pagination: { limit },
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  })

  if (!result.success) return mcpError(result.error?.message || 'Failed to list payments', 500)
  const items = (result.data as any[]).map((row) => ({ id: row.id, ...(row.data || row) }))
  return mcpOk({ items, total: items.length })
})
