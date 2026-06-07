import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

const adapter = new PostgreSQLStoreAdapter()
type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const product = await adapter.getProductById(id)
  if (!product) return mcpError('Product not found', 404)
  return mcpOk(product)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  await initializeDatabase()
  const db = getDatabaseService()
  const update = await db.update('store_products', id, body)
  if (!update.success) return mcpError(update.error?.message || 'Update failed', 400)
  const product = await adapter.getProductById(id)
  return mcpOk(product)
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('Destructive operation requires confirm: true', 400)

  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.update('store_products', id, { status: 'archived' })
  if (!result.success) return mcpError(result.error?.message || 'Delete failed', 400)
  return mcpOk({ deleted: true, id })
})
