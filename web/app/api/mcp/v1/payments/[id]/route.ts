import { z } from 'zod'
import { getPaymentAttempt, updatePaymentStatus } from '@/features/auth/services/payment-tracking'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Define the type for the context parameter. It contains a params promise for the route.
type Ctx = { params: Promise<{ id: string }> }

// Valid payment statuses — matches PaymentStatus type from payment-tracking.
const paymentStatusSchema = z.object({
  status: z.enum(['initiated', 'completed', 'failed', 'cancelled']),
  failureReason: z.string().optional(),
}).passthrough()

// GET endpoint: Retrieve a payment attempt by ID.
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const payment = await getPaymentAttempt(id)
  if (!payment) return mcpError('Payment not found', 404)
  return mcpOk(payment)
})

// PATCH endpoint: Update the status of a payment attempt by ID.
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const parsed = paymentStatusSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'status is required', 400)
  }

  const { status, failureReason } = parsed.data
  await updatePaymentStatus(id, status, failureReason)

  const payment = await getPaymentAttempt(id)
  return mcpOk(payment)
})
