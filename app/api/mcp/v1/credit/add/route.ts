import { UserCreditService } from '@/features/wallet/services/user-credit-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('credit add requires confirm: true', 400)
  if (!body?.userId || !body?.amount) return mcpError('userId and amount are required', 400)

  const service = UserCreditService.getInstance()
  const result = await service.addCredits(
    String(body.userId),
    {
      amount: String(body.amount),
      description: String(body.description || 'ring-mcp credit add'),
      metadata: body.metadata as Record<string, unknown> | undefined,
    },
    (body.type as any) || 'bonus',
    String(body.usdRate || '1')
  )

  return mcpOk(result)
})
