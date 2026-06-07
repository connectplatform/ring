import { createNotification } from '@/features/notifications/services/notification-service'
import { NotificationType } from '@/features/notifications/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (!body?.title || !body?.body) return mcpError('title and body are required', 400)
  if (!body?.userId && !body?.userIds) return mcpError('userId or userIds is required', 400)

  const notification = await createNotification({
    userId: body.userId as string | undefined,
    userIds: body.userIds as string[] | undefined,
    type: (body.type as NotificationType) || NotificationType.SYSTEM_UPDATE,
    title: String(body.title),
    body: String(body.body),
    actionText: body.actionText as string | undefined,
    actionUrl: body.actionUrl as string | undefined,
    data: body.data as Record<string, unknown> | undefined,
    channels: body.channels as any,
    priority: body.priority as any,
  })

  return mcpOk(notification, 201)
})
