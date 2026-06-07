import { FCMService } from '@/features/notifications/services/fcm-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('fcm send requires confirm: true', 400)
  if (!body?.title || !body?.body) return mcpError('title and body are required', 400)

  const fcm = new FCMService()
  const notification = {
    title: String(body.title),
    body: String(body.body),
    icon: body.icon as string | undefined,
    data: body.data as Record<string, string> | undefined,
  }

  if (body.userId) {
    await fcm.sendToUser(String(body.userId), notification)
  } else if (body.userIds && Array.isArray(body.userIds)) {
    await fcm.sendToUsers(body.userIds.map(String), notification)
  } else {
    await fcm.sendToAllUsers(notification)
  }

  return mcpOk({ sent: true })
})
