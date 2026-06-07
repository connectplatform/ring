import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  const service = UserCreditService.getInstance()
  const balance = await service.getUserCreditBalance(userId)
  return mcpOk({ userId, balance })
})
