import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

// Context type for handling route params. Contains a Promise that resolves to an object with 'id'.
type Ctx = { params: Promise<{ id: string }> }

// GET handler wrapped with auth guard.
// Handles fetching a store order by its 'id' parameter.
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  // Await the 'id' from context params (if undefined, fallback to empty id).
  // TODO: In Next.js 16, consider using improved route params handling if available and drop manual Promise.resolve fallback.
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Query the StoreOrdersService for the order by its id.
  // If StoreOrdersService is a stub or mock:
  // MOCK CODE, TODO: Replace StoreOrdersService.getOrderById with actual implementation.
  // Steps:
  // 1. Connect to the real order service backend.
  // 2. Remove mock data returns.
  // 3. Write integration tests.

  const order = await StoreOrdersService.getOrderById(id)

  // If the order does not exist, return an error response with 404 status.
  if (!order) return mcpError('Order not found', 404)

  // If found, return successful response with order data.
  return mcpOk(order)
})
