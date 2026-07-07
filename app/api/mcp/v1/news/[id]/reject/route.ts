import { rejectMainPagePublication } from '@/features/news/services/news-promotion-workflow'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Type for context, expects a params promise with "id"
type Ctx = { params: Promise<{ id: string }> }

// API POST handler wrapped with MCP guard (auth/authorization)
export const POST = withMcpGuard(async (request, actor, context?: Ctx) => {
  // Extract the news ID from the route/context params
  // TODO: If Next16/React19 provides native route param helpers, refactor for clarity
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  
  // Parse the JSON body from the POST request
  // Returns undefined if body is invalid or missing
  const body = await readJsonBody(request)
  
  // Require explicit confirmation in the request body to proceed
  if (body?.confirm !== true) {
    // Respond with error if confirmation is not present/true
    return mcpError('Reject requires confirm: true in body', 400)
  }

  // Attempt to reject/news main page publication with provided reason or a default note
  // Passes in news id, actor making the request, and the reason for rejection
  await rejectMainPagePublication(
    id,
    actor.id,
    String(body.reason || 'Rejected via ring-mcp')
  )
  
  // Respond with success, indicating the news has been rejected
  return mcpOk({ rejected: true, id })
})
