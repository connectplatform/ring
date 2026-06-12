import { db } from '@/lib/database'
import { updateNewsArticle, deleteNewsArticle } from '@/features/news/services/news-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError, mcpFromResult } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const result = await db().findDocById('news', id)
  if (!result.success || !result.data) return mcpError('Article not found', 404)
  return mcpOk(result.data)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const result = await updateNewsArticle(id, body as any)
  return mcpFromResult(result)
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) {
    return mcpError('Destructive operation requires confirm: true in body', 400)
  }
  const result = await deleteNewsArticle(id)
  return mcpFromResult(result)
})
