import { FCMService } from '@/features/notifications/services/fcm-service'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// POST handler for FCM notification sending endpoint
export const POST = withMcpGuard(async (request) => {
  // Parse and validate the incoming JSON request body
  const body = await readJsonBody(request)

  // Require explicit confirmation before sending FCM messages
  if (body?.confirm !== true) {
    return mcpError('fcm send requires confirm: true', 400)
  }

  // Require both a title and body for the notification
  if (!body?.title || !body?.body) {
    return mcpError('title and body are required', 400)
  }

  // Instantiate the FCM service
  const fcm = new FCMService()

  // Construct the notification object with optional icon and data
  const notification = {
    title: String(body.title),
    body: String(body.body),
    icon: body.icon as string | undefined,
    data: body.data as Record<string, string> | undefined,
  }

  // Determine send method based on targetting: single user, multiple users, or all users
  if (body.userId) {
    await fcm.sendToUser(String(body.userId), notification)
  } else if (body.userIds && Array.isArray(body.userIds)) {
    await fcm.sendToUsers(body.userIds.map(String), notification)
  } else {
    await fcm.sendToAllUsers(notification)
  }

  // Respond with success
  return mcpOk({ sent: true })
  // TODO: Consider using Next.js 16 server actions for POST endpoint with enhanced type-safety and built-in validation.
})
