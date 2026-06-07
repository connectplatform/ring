import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  const limit = queryInt(request, 'limit', 50)
  const statusFilter = queryString(request, 'status') as any

  if (userId) {
    const result = await StoreOrdersService.listOrdersForUser(userId, { limit })
    return mcpOk(result)
  }

  const result = await StoreOrdersService.adminListAllOrders({
    limit,
    statusFilter,
    startAfter: queryString(request, 'startAfter'),
  })
  return mcpOk(result)
})
