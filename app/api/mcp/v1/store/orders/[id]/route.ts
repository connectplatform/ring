import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const order = await StoreOrdersService.getOrderById(id)
  if (!order) return mcpError('Order not found', 404)
  return mcpOk(order)
})
