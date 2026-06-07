import { rejectMainPagePublication } from '@/features/news/services/news-promotion-workflow'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (request, actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) {
    return mcpError('Reject requires confirm: true in body', 400)
  }
  await rejectMainPagePublication(id, actor.id, String(body.reason || 'Rejected via ring-mcp'))
  return mcpOk({ rejected: true, id })
})
