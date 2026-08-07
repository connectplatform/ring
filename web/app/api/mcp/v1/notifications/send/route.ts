import { createNotification } from '@/features/notifications/services/notification-service'
import { NotificationType } from '@/features/notifications/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Handle POST request for sending notifications, guarded by withMcpGuard middleware
export const POST = withMcpGuard(async (request) => {
  // Parse and validate JSON request body
  const body = await readJsonBody(request)

  // Ensure both title and body are present in the request
  if (!body?.title || !body?.body) {
    // Respond with error if required fields are missing
    return mcpError('title and body are required', 400)
  }

  // Ensure at least one of userId or userIds is provided
  if (!body?.userId && !body?.userIds) {
    // Respond with error if recipient information is missing
    return mcpError('userId or userIds is required', 400)
  }

  // Construct notification options and call service to create notification
  // TODO: If there is type inference leakage, consider using Next.js server actions for type-safe mutation submission (React 19, Next 16)
  const notification = await createNotification({
    userId: body.userId as string | undefined,                         // Single user ID (optional)
    userIds: body.userIds as string[] | undefined,                     // Multiple user IDs (optional)
    type: (body.type as NotificationType) || NotificationType.SYSTEM_UPDATE, // Notification type, defaulting to SYSTEM_UPDATE
    title: String(body.title),                                         // Notification title, forcibly string
    body: String(body.body),                                           // Notification body, forcibly string
    actionText: body.actionText as string | undefined,                 // Optional action text
    actionUrl: body.actionUrl as string | undefined,                   // Optional action URL
    data: body.data as Record<string, unknown> | undefined,            // Optional extra data
    channels: body.channels as any,                                    // Delivery channels (unsafely cast, could tighten)
    priority: body.priority as any,                                    // Delivery priority (unsafely cast, could tighten)
    // MOCK CODE, TODO: If backend is not implemented: 
    //   1. Simulate notification send
    //   2. Replace with real dispatch once backend is ready
  })

  // Respond with notification data and a 201 Created status
  return mcpOk(notification, 201)
})
