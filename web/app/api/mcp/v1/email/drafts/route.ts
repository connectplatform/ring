import { EmailThreadService } from '@/features/email-crm/services/email-thread-service'
import { getEmailDraftService } from '@/features/email-crm/pipeline/drafts/draft-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

function queryLimit(request: Parameters<typeof queryInt>[0], fallback = 100, max = 200): number {
  const value = queryInt(request, 'limit', fallback) ?? fallback
  if (value < 1) return fallback
  return Math.min(value, max)
}

export const GET = withMcpGuard(async (request) => {
  const sourceChannel = queryString(request, 'sourceChannel')
  const limit = queryLimit(request)

  let items = await getEmailDraftService().getPendingDrafts(sourceChannel ? 500 : limit)

  // Optional channel filter is applied through the parent thread.
  if (sourceChannel) {
    const threads = await EmailThreadService.listThreads({ sourceChannel, limit: 500 })
    const ids = new Set(threads.map((thread) => thread.id))
    items = items.filter((draft) => ids.has(draft.threadId)).slice(0, limit)
  }

  return mcpOk({ items, total: items.length })
})
