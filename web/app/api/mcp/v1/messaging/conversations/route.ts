import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// Handler for GET requests. Wraps logic with access guard (authentication/authorization)
export const GET = withMcpGuard(async (request) => {
  // Extract 'userId' query parameter
  const userId = queryString(request, 'userId')
  // If no userId is supplied, immediately error out with a 400 (bad request)
  if (!userId) return mcpError('userId query parameter is required', 400)

  // Extract 'limit' query parameter, defaulting to 50 if not present or invalid
  const limit = queryInt(request, 'limit', 50) || 50

  // Query the database for 'conversations', ordered by 'lastActivity' descending, limited by 'limit'
  // TODO: If possible, move userId participant filter into db query for efficiency.
  const result = await db().queryDocs({
    collection: 'conversations',
    pagination: { limit },
    orderBy: [{ field: 'lastActivity', direction: 'desc' }],
  })

  // If query failed, respond with the error and a 500 status code
  if (!result.success) return mcpError(result.error?.message || 'Failed to list conversations', 500)

  // Use empty array as fallback if data is undefined/null
  const rows = result.data ?? []

  // Filter only conversations in which the user is a participant.
  // 'participants' can hold items with 'userId' or legacy 'user_id' fields.
  // Type assertion is needed for TS.
  // TODO: Consider normalizing participant schema at write for future maintenance.
  const items = rows.filter((conversation) => {
    const participants = Array.isArray(conversation.participants)
      ? (conversation.participants as Array<{ userId?: string; user_id?: string }>)
      : []
    // Match if any participant matches input userId on either possible field.
    return participants.some((p) => p.userId === userId || p.user_id === userId)
  })

  // Return successful response, including filtered items and total count.
  return mcpOk({ items, total: items.length })
})
