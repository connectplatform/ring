import { z } from 'zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// Valid order statuses — matches StoreOrdersService.adminListAllOrders statusFilter type.
const ORDER_STATUSES = ['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'] as const
const orderStatusSchema = z.enum(ORDER_STATUSES).optional()

// GET handler for MCP Store Orders endpoint, wrapped with permissions guard
export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  const limit = queryInt(request, 'limit', 50)

  // Parse status filter with Zod enum — eliminates the 'as any' cast
  const statusRaw = queryString(request, 'status')
  const statusParsed = orderStatusSchema.safeParse(statusRaw)
  const statusFilter = statusParsed.success ? statusParsed.data : undefined

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
