import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import {
  CreditHistoryRequestSchema,
  type CreditTransactionType,
} from '@/lib/zod/credit-schemas'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  const rawType = queryString(request, 'type')
  const queryParams = {
    limit: queryInt(request, 'limit', 50) ?? 50,
    after_id: queryString(request, 'after_id'),
    type: rawType as CreditTransactionType | undefined,
    start_date: queryInt(request, 'start_date'),
    end_date: queryInt(request, 'end_date'),
  }

  const parsed = CreditHistoryRequestSchema.safeParse(queryParams)
  if (!parsed.success) {
    return mcpError('Invalid query parameters (see /api/wallet/credit/history for supported fields)', 400)
  }

  const service = UserCreditService.getInstance()
  const history = await service.getCreditHistory(userId, parsed.data)

  return mcpOk(history)
})
