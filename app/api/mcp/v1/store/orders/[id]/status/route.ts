import { z } from 'zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

const OrderStatusSchema = z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'])

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const parsed = OrderStatusSchema.safeParse(body?.status)
  if (!parsed.success) {
    return mcpError(
      'status is required and must be one of: new, paid, processing, shipped, completed, canceled',
      400
    )
  }

  const result = await StoreOrdersService.adminUpdateOrderStatus(id, parsed.data)
  return mcpOk(result)
})
