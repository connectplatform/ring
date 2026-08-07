import { getUserNotifications } from '@/features/notifications/services/notification-service'
import type { NotificationType } from '@/features/notifications/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// The GET handler is wrapped by withMcpGuard to enforce authentication/authorization middleware.
export const GET = withMcpGuard(async (request) => {
  // Attempt to read the 'userId' from query string parameters.
  const userId = queryString(request, 'userId')
  if (!userId) {
    // If no userId is present, return error response. Provide clear error messaging with status.
    return mcpError('userId query parameter is required', 400)
  }

  // Optionally read the 'types' query parameter as a comma-separated string.
  const typesParam = queryString(request, 'types')
  // Map the received string types into an array of NotificationType, filtering out empty strings.
  const types = typesParam
    ? (typesParam.split(',').filter(Boolean) as NotificationType[])
    : undefined

  // Call the user notification fetch logic with parameters parsed from request.
  // TODO: Consider using Zod (or similar) schema for query validation, native in Next.js 16+ route handlers.
  //       This guards and self-documents input parsing.
  const result = await getUserNotifications(userId, {
    // Parse 'limit' as integer from query, falling back to 50 if not set or invalid.
    limit: queryInt(request, 'limit', 50) ?? 50,
    // Get the optional 'startAfter' paging parameter.
    startAfter: queryString(request, 'startAfter'),
    // Parse 'unreadOnly' as boolean (true if query string is 'true', otherwise false).
    unreadOnly: queryString(request, 'unreadOnly') === 'true',
    types,
  })

  // If call succeeds, respond with the result wrapped by the MCP OK utility.
  return mcpOk(result)
})
