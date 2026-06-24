import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { parseCreditHistoryQuery } from '@/lib/wallet/parse-credit-history-query'
import { queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  const parsed = parseCreditHistoryQuery(request)
  if (parsed.success === false) {
    return mcpError(
      'Invalid query parameters (see /api/wallet/credit/history for supported fields)',
      400,
    )
  }

  const service = UserCreditService.getInstance()
  const history = await service.getCreditHistory(userId, parsed.data)

  return mcpOk(history)
})
