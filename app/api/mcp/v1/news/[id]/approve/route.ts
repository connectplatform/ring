import { approveMainPagePublication } from '@/features/news/services/news-promotion-workflow'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (_request, actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  await approveMainPagePublication(id, actor.id)
  return mcpOk({ approved: true, id })
})
