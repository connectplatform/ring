import { z } from 'zod'
import { db } from '@/lib/database'
import { updateNewsArticle, deleteNewsArticle } from '@/features/news/services/news-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError, mcpFromResult } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Context type: expects a 'params' promise resolving to route params {id: string}
type Ctx = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Update-news-article schema — partial update body, every field optional.
// Validates structural shape; .passthrough() allows service-layer validation.
// ---------------------------------------------------------------------------
const updateNewsSchema = z.object({}).passthrough()

// GET handler to fetch a news article by ID
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const result = await db().findDocById('news', id)
  if (!result.success || !result.data) return mcpError('Article not found', 404)
  return mcpOk(result.data)
})

// PATCH handler to update a news article by ID
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const parsed = updateNewsSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  // Double cast is safe — Zod verified the body is a valid object; service validates full NewsFormData
  const result = await updateNewsArticle(id, parsed.data as unknown as Parameters<typeof updateNewsArticle>[1])

  // Invalidate news-stats cache + revalidate admin paths
  if (result.success) {
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: id,
      event: 'updated',
    })
  }

  return mcpFromResult(result)
})

// DELETE handler to delete a news article by ID
export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) {
    return mcpError('Destructive operation requires confirm: true in body', 400)
  }
  const result = await deleteNewsArticle(id)

  // Invalidate news-stats cache + revalidate admin paths
  if (result.success) {
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: id,
      event: 'deleted',
    })
  }

  return mcpFromResult(result)
})
