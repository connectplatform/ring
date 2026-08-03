/**
 * MCP stock get / list low-stock.
 * GET /api/mcp/v1/store/stock?productId=...
 * GET /api/mcp/v1/store/stock?low=1&limit=50
 */

import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { listActiveReservationsForOrder } from '@/features/store/services/inventory-sync'

export const GET = withMcpGuard(async (request) => {
  const productId = queryString(request, 'productId')
  const orderId = queryString(request, 'orderId')
  const low = queryString(request, 'low')
  const limit = queryInt(request, 'limit', 50)

  if (orderId) {
    const reservations = await listActiveReservationsForOrder(orderId)
    return mcpOk({ orderId, reservations, total: reservations.length })
  }

  if (productId) {
    const level = await ERPStockService.getStockLevel(productId)
    if (!level) return mcpError('Product not found', 404)
    return mcpOk(level)
  }

  if (low === '1' || low === 'true') {
    const products = await ERPStockService.getLowStockProducts()
    return mcpOk({
      items: products.slice(0, limit).map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock ?? 0,
        inStock: p.inStock,
      })),
      total: products.length,
    })
  }

  const summary = await ERPStockService.getStockSummary()
  return mcpOk(summary)
})
