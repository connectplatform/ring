import { db } from '@/lib/database'
import { getUserPaymentHistory } from '@/features/auth/services/payment-tracking'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// Endpoint for handling GET requests related to payment history.
// Wrapped with `withMcpGuard` for access control.
export const GET = withMcpGuard(async (request) => {
  // Try to get the 'userId' query parameter from the request.
  const userId = queryString(request, 'userId')

  // If a userId is present, fetch payment history for that user.
  if (userId) {
    // TODO: Consider error handling if getUserPaymentHistory fails.
    // Fetch user's payment history via service.
    const items = await getUserPaymentHistory(userId)
    // Respond with the payment history and total count.
    return mcpOk({ items, total: items.length })
  }

  // Otherwise, handle generic listing of payments with pagination.
  // Get the 'limit' query parameter. Default to 50 if not provided or invalid.
  // TODO: Consider allowing pagination with 'cursor' or 'offset' for scalability.
  const limit = queryInt(request, 'limit', 50) || 50

  // Query the payments collection in the database.
  // Orders by 'createdAt' in descending order for most recent first.
  const result = await db().queryDocs({
    collection: 'payments',
    pagination: { limit },
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  })

  // If the query failed, respond with error message and status 500.
  if (!result.success)
    return mcpError(
      result.error?.message || 'Failed to list payments',
      500
    )

  // On success, return the items and how many there are.
  const items = result.data ?? []
  return mcpOk({ items, total: items.length })
})
