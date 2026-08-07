import { CreditBalanceService, creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { parseCreditHistoryQuery } from '@/lib/wallet/parse-credit-history-query'
import { queryString } from '@/app/api/mcp/v1/_lib/query'

// Handler for GET requests, wrapped with MCP guard for authentication/authorization
export const GET = withMcpGuard(async (request) => {
  // Extract userId from query parameters
  const userId = queryString(request, 'userId')
  if (!userId) {
    // Return 400 if userId is missing
    return mcpError('userId query parameter is required', 400)
  }

  // Parse additional credit history query parameters (e.g., filters, pagination)
  const parsed = parseCreditHistoryQuery(request)
  if (parsed.success === false) {
    // Return 400 if supplied query parameters are invalid
    return mcpError(
      'Invalid query parameters (see /api/wallet/credit/history for supported fields)',
      400,
    )
  }

  // Obtain a singleton instance of the credit service
  const service = CreditBalanceService.getInstance()
  console.log('service', service)
  // Retrieve credit history for the user based on parsed query
  const history = await service.getCreditHistory(userId, parsed.data)

  // Respond with the result
  return mcpOk(history)
})

// TODO: Consider leveraging Next.js 16 Route Handlers and type-safety enhancements (such as automatic query param validation using zod or similar).
// TODO: Investigate using the new app router conventions for route handlers (exporting functions like GET/POST as route segments), if not already doing so.
// TODO: If streaming large data sets, explore native React/Next streaming response support for efficiency.