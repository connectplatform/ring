import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

const adapter = new PostgreSQLStoreAdapter()

export const GET = withMcpGuard(async () => {
  const products = await adapter.listProducts()
  return mcpOk({ items: products, total: products.length })
})

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (!body?.vendorId) return mcpError('vendorId is required', 400)
  const product = await adapter.createProduct(body as any)
  return mcpOk(product, 201)
})
