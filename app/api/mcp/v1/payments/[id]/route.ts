import { getPaymentAttempt, updatePaymentStatus } from '@/features/auth/services/payment-tracking'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const payment = await getPaymentAttempt(id)
  if (!payment) return mcpError('Payment not found', 404)
  return mcpOk(payment)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (!body?.status) return mcpError('status is required', 400)

  await updatePaymentStatus(id, body.status as any, body.failureReason as string | undefined)
  const payment = await getPaymentAttempt(id)
  return mcpOk(payment)
})
