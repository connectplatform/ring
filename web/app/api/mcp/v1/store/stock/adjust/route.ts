/**
 * MCP stock adjust (admin service token).
 * POST /api/mcp/v1/store/stock/adjust
 * Body: { productId, quantityChange, operation: add|subtract, reason }
 * operation=set is closed. Add and subtract go through adjustWarehouseStock on zero-warehouse.
 */

import { z } from 'zod'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { stockOperationAllowed } from '@/features/store/services/fulfillment-ledger'
import { adjustWarehouseStock } from '@/features/store/services/warehouse-fulfillment'

const adjustSchema = z.object({
  productId: z.string().min(1),
  quantityChange: z.number().finite(),
  operation: z.enum(['add', 'subtract', 'set']),
  reason: z.string().optional(),
  confirm: z.boolean().optional(),
})

export const POST = withMcpGuard(async (request, actor) => {
  if (!isPlatformAdmin(actor.role)) {
    return mcpError('Admin access required for stock adjust', 403)
  }

  const body = await readJsonBody(request)
  const parsed = adjustSchema.safeParse(body)
  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid payload', 400)
  }

  const { productId, quantityChange, operation, reason } = parsed.data
  if (!stockOperationAllowed(operation)) {
    return mcpError('Set stock is closed. Add or subtract a quantity.', 400)
  }
  if (!reason?.trim()) {
    return mcpError('Reason is required', 400)
  }
  const quantity = Math.floor(Math.abs(quantityChange))
  if (quantity < 1) {
    return mcpError('Quantity is required', 400)
  }

  try {
    await adjustWarehouseStock({
      warehouseId: ZERO_WAREHOUSE_ID,
      productId,
      quantity,
      direction: operation,
      reason: reason.trim(),
      userId: actor.id,
    })
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : 'Stock adjust failed', 400)
  }

  const level = await ERPStockService.getStockLevel(productId)
  return mcpOk({ newQuantity: level?.totalQuantity ?? quantity, level })
})
