import { suspendVendor } from '@/features/store/services/vendor-lifecycle'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('Suspend requires confirm: true in body', 400)

  await suspendVendor(
    id,
    String(body.reason || 'Suspended via ring-mcp'),
    Number(body.durationDays ?? 30)
  )
  return mcpOk({ suspended: true, id })
})
