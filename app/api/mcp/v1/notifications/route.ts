import { getUserNotifications } from '@/features/notifications/services/notification-service'
import type { NotificationType } from '@/features/notifications/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const userId = queryString(request, 'userId')
  if (!userId) return mcpError('userId query parameter is required', 400)

  const typesParam = queryString(request, 'types')
  const types = typesParam
    ? (typesParam.split(',').filter(Boolean) as NotificationType[])
    : undefined

  const result = await getUserNotifications(userId, {
    limit: queryInt(request, 'limit', 50) ?? 50,
    startAfter: queryString(request, 'startAfter'),
    unreadOnly: queryString(request, 'unreadOnly') === 'true',
    types,
  })

  return mcpOk(result)
})
