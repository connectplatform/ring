import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { updateNewsArticle, deleteNewsArticle } from '@/features/news/services/news-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError, mcpFromResult } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.findById('news', id)
  if (!result.success || !result.data) return mcpError('Article not found', 404)
  const data = (result.data as any).data || result.data
  return mcpOk({ id, ...data })
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
