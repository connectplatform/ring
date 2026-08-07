import { db } from '@/lib/database'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

const adapter = new PostgreSQLStoreAdapter()

// Ctx type: expects a promise resolving to params with 'id'
type Ctx = { params: Promise<{ id: string }> }

// GET endpoint for retrieving a store product by its ID
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  // Obtain the product ID from context params, or provide a default
  // TODO: If Next16's route parameters are natively available, refactor to use `context.params.id` synchronously (if possible).
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Retrieve product using the adapter
  const product = await adapter.getProductById(id)

  // Return 404 error if the product is not found
  if (!product) return mcpError('Product not found', 404)

  // Otherwise, return the product details
  return mcpOk(product)
})

// PATCH endpoint for updating a store product by its ID
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  // Get the product ID from context
  // TODO: Refactor param handling for Next16 middleware improvements, if applicable.
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Parse JSON body from the request
  const body = await readJsonBody(request)

  // Update the product in the database
  const update = await db().updateDoc('store_products', id, body)
  // If update failed, return an error message
  if (!update.success) return mcpError(update.error?.message || 'Update failed', 400)

  // Return the updated product (freshly fetched after update)
  const product = await adapter.getProductById(id)
  return mcpOk(product)
})

// DELETE endpoint for marking a product as deleted
export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  // Extract product ID from context params
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Parse JSON body from the request
  const body = await readJsonBody(request)

  // Validate that the user has confirmed the destructive operation
  if (body?.confirm !== true) {
    // Defensive: Only delete if explicit confirmation is present
    return mcpError('Destructive operation requires confirm: true', 400)
  }

  // Mark the product as deleted in the database (soft delete)
  const result = await db().updateDoc('store_products', id, { status: 'deleted' })

  // Return error if soft delete failed
  if (!result.success) return mcpError(result.error?.message || 'Delete failed', 400)

  // Return confirmation of the delete operation
  return mcpOk({ deleted: true, id })
})
