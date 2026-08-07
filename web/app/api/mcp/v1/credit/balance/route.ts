import { CreditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryString } from '@/app/api/mcp/v1/_lib/query'

/**
 * GET route handler for retrieving user credit balance.
 * 
 * @description
 * - Secured via MCP guard (authentication/authorization wrapper)
 * - Expects 'userId' as a query parameter
 * - Returns the user's credit balance as a JSON payload
 * 
 * @param request {NextRequest|CustomRequest} The standardized request object (Next.js Request or custom)
 * @returns JSON API response with userId and balance, or error message
 * 
 * @note
 * TODO: Switch from custom query string util to Next.js native searchParams API for improved type-safety and performance.
 *       e.g. `const userId = request.nextUrl.searchParams.get('userId')`
 * TODO: Typing improvement: In Next.js 13/14/16+, type `request` with native `NextRequest` for full streaming/edge support.
 * TODO: Use Response.json or streaming responses in Next.js (native fetch/streaming features) as needed.
 */
export const GET = withMcpGuard(async (request) => {
  // Try to extract the userId query parameter from the URL.
  // TODO: Replace with native searchParams for type-safety: `const userId = request.nextUrl?.searchParams.get('userId')`
  const userId = queryString(request, 'userId')
  
  // If userId is not present, return a standardized error and exit early.
  if (!userId) {
    return mcpError('userId query parameter is required', 400)
  }

  // Get a singleton instance of CreditBalanceService.
  // (If possible, refactor all usages to use dependency injection for improved testability.)
  const service = CreditBalanceService.getInstance()
  
  // STUB: Check if service and method implementations are production-ready.
  //       If getUserCreditBalance is a stub, implement actual database/service logic here.
  /**
   * STUB:
   * TODO:
   *   1. Implement actual data layer integration (e.g. fetch from database or wallet microservice)
   *   2. Handle and log service errors
   *   3. Consider request caching if balance is not volatile
   */
  const balance = await service.getUserCreditBalance(userId)
  
  // Return the resulting userId and balance as a standardized OK response object.
  // TODO: Change to native Response.json({ userId, balance }) if migrating fully to Next 13+/16 API routes.
  return mcpOk({ userId, balance })

  // NOTE: Consider switching error handling to throw/catch (Next.js native error boundary)
})
