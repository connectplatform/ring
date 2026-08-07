import { z } from 'zod'
import { updateTag } from 'next/cache'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Instantiate the store adapter for PostgreSQL operations
const adapter = new PostgreSQLStoreAdapter()

// ---------------------------------------------------------------------------
// Create-product schema — vendorId is required; extra fields pass through to
// the adapter via .passthrough().
// ---------------------------------------------------------------------------
const createProductSchema = z.object({
  vendorId: z.string().min(1, 'vendorId is required'),
}).passthrough()

/**
 * Handle GET requests for listing products.
 * - Protected by withMcpGuard middleware.
 * - Retrieves all products via the adapter.
 * - Responds with the products array and total count.
 */
export const GET = withMcpGuard(async () => {
  const products = await adapter.listProducts()
  return mcpOk({ items: products, total: products.length })
})

/**
 * Handle POST requests for creating a product.
 * - Protected by withMcpGuard middleware.
 * - Validates the presence of 'vendorId' in the request body via Zod schema.
 * - Delegates creation to the adapter.
 * - Returns the created product with 201 status code.
 */
export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const parsed = createProductSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'vendorId is required', 400)
  }

  const product = await adapter.createProduct(parsed.data)

  // Invalidate the `getCachedProductCatalog()` SSOT (features/store/config.ts)
  // so MCP-created products are visible immediately, not after cacheLife('minutes').
  updateTag('store:products')

  return mcpOk(product, 201)
})
