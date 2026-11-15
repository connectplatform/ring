import { EmailThreadService, type EmailThreadStatus } from '@/features/email-crm/services/email-thread-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

const THREAD_STATUSES = new Set<EmailThreadStatus>(['new', 'ongoing', 'waiting', 'resolved'])
const ROUTE_FLAGS = new Set(['crm_email_lead', 'spam_osint_queue'])

function queryLimit(request: Parameters<typeof queryInt>[0], fallback = 100, max = 200): number {
  const value = queryInt(request, 'limit', fallback) ?? fallback
  if (value < 1) return fallback
  return Math.min(value, max)
}

export const GET = withMcpGuard(async (request) => {
  const statusRaw = queryString(request, 'status')
  const status =
    statusRaw && THREAD_STATUSES.has(statusRaw as EmailThreadStatus)
      ? (statusRaw as EmailThreadStatus)
      : undefined

  const routeFlagRaw = queryString(request, 'routeFlag')
  const routeFlag =
    routeFlagRaw && ROUTE_FLAGS.has(routeFlagRaw) ? routeFlagRaw : undefined

  const items = await EmailThreadService.listThreads({
    status,
    sourceChannel: queryString(request, 'sourceChannel'),
    routeFlag,
    limit: queryLimit(request),
  })

  return mcpOk({ items, total: items.length })
})
