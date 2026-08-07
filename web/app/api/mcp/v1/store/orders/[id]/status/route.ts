import { z } from 'zod'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Zod enum schema for allowed order statuses.
// Ensures only accepted values can be provided as a status.
const OrderStatusSchema = z.enum(['new', 'paid', 'processing', 'shipped', 'completed', 'canceled'])

// Context type for extracting route parameters, primarily the order id.
// params is an async provider of the route's dynamic id segment.
type Ctx = { params: Promise<{ id: string }> }

// PATCH method: Used to update the status of a specific store order.
// Uses withMcpGuard to wrap all logic with authorization/checks.
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  // Extract the order id from route parameters, defaulting to an empty string if missing.
  // TODO: If Next.js 16 Route Handler context param type changes, refactor extraction logic.
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  
  // Parse the incoming request body as JSON.
  // TODO: With new Next.js Route Handlers, use native middleware for body parsing when available.
  const body = await readJsonBody(request)
  
  // Validate that the provided 'status' field exists and is one of the allowed enum values.
  // The Zod safeParse returns a success boolean and either data or issues.
  const parsed = OrderStatusSchema.safeParse(body?.status)
  
  if (!parsed.success) {
    // If validation fails, return a 400 error with a descriptive message.
    return mcpError(
      'status is required and must be one of: new, paid, processing, shipped, completed, canceled',
      400
    )
  }

  // If validation succeeds, update the order status using the service.
  // This method should handle DB access/business logic for order state transition.
  // TODO: If StoreOrdersService.adminUpdateOrderStatus is a stub/mocked method, annotate:
  // MOCK CODE, TODO: Implement adminUpdateOrderStatus to update DB and handle errors robustly.
  const result = await StoreOrdersService.adminUpdateOrderStatus(id, parsed.data)
  
  // Return the (presumably serialized) result as a successful response.
  return mcpOk(result)
})
