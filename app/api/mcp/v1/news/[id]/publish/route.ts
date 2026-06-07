import { updateNewsArticle } from '@/features/news/services/news-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpFromResult } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const result = await updateNewsArticle(id, {
    ...(body as any),
    status: 'published',
  })
  return mcpFromResult(result)
})
