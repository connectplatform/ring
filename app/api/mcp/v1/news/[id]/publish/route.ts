import { z } from 'zod'
import { updateNewsArticle } from '@/features/news/services/news-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpFromResult, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Context type, expects params to be a Promise resolving to an object with an 'id' property
type Ctx = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Publish-article schema — body must be a valid object; .passthrough() accepts
// any extra article fields.  Status is forced to 'published' by the handler.
// ---------------------------------------------------------------------------
const publishArticleSchema = z.object({}).passthrough()

// HTTP POST handler for publishing a news article
export const POST = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const parsed = publishArticleSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  const result = await updateNewsArticle(id, {
    ...parsed.data,
    status: 'published',
  } as Parameters<typeof updateNewsArticle>[1])

  // Invalidate news-stats cache + revalidate admin paths
  if (result.success) {
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: id,
      event: 'published',
    })
  }

  return mcpFromResult(result)
})
