/**
 * MCP stock adjust (admin service token).
 * POST /api/mcp/v1/store/stock/adjust
 * Body: { productId, quantityChange, operation: add|subtract|set, reason? }
 */

import { z } from 'zod'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'

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

  const { productId, quantityChange, operation, reason, confirm } = parsed.data
  if (operation === 'set' && confirm !== true) {
    return mcpError('operation=set requires confirm: true', 400)
  }

  const result = await ERPStockService.updateStock({
    productId,
    warehouseId: ZERO_WAREHOUSE_ID,
    quantityChange,
    operation,
    reason: reason || `MCP stock adjust by ${actor.id}`,
    userId: actor.id,
  })

  if (!result.success) {
    return mcpError(result.error || 'Stock adjust failed', 400)
  }

  const level = await ERPStockService.getStockLevel(productId)
  return mcpOk({ newQuantity: result.newQuantity, level })
})
